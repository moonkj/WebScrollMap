//
//  SafariWebExtensionHandler.swift
//  WebScrollMap Extension
//
//  StoreKit 2 기반 Pro 구매 검증 + CoreHaptics.
//  Extension (JS) → browser.runtime.sendNativeMessage → 여기.
//

import SafariServices
import StoreKit
import os.log
#if canImport(CoreHaptics)
import CoreHaptics
#endif

// MARK: - Shared types (JS Entitlement과 1:1 매칭)

private let SALT: UInt32 = 0x7eb3c4d5
private let GRACE_MS: Int64 = 14 * 24 * 60 * 60 * 1000 // 14일
private let PRODUCT_ID = "com.kjmoon.WebScrollMap.Pro"
private let DEVICE_ID_KEY = "wsm.deviceId.v1"

private func djb2(_ str: String) -> UInt32 {
    var h: UInt32 = 5381
    for u in str.unicodeScalars {
        h = ((h << 5) &+ h) &+ u.value
    }
    return h
}

// MARK: - Entitlement Manager

final class EntitlementManager {
    static let shared = EntitlementManager()

    var deviceId: String {
        if let existing = UserDefaults.standard.string(forKey: DEVICE_ID_KEY) {
            return existing
        }
        let newId = UUID().uuidString
        UserDefaults.standard.set(newId, forKey: DEVICE_ID_KEY)
        return newId
    }

    @available(iOS 15.0, macOS 12.0, *)
    func currentEntitlement() async -> [String: Any] {
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result, transaction.productID == PRODUCT_ID {
                let purchasedAt = Int64(transaction.originalPurchaseDate.timeIntervalSince1970 * 1000)
                return buildProEntitlement(purchasedAt: purchasedAt)
            }
        }
        return buildFreeEntitlement()
    }

    @available(iOS 15.0, macOS 12.0, *)
    func purchase() async -> [String: Any] {
        do {
            guard let product = try await Product.products(for: [PRODUCT_ID]).first else {
                return await currentEntitlement()
            }
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                if case .verified(let transaction) = verification {
                    await transaction.finish()
                    let purchasedAt = Int64(transaction.originalPurchaseDate.timeIntervalSince1970 * 1000)
                    return buildProEntitlement(purchasedAt: purchasedAt)
                }
                return await currentEntitlement()
            case .userCancelled, .pending:
                return await currentEntitlement()
            @unknown default:
                return await currentEntitlement()
            }
        } catch {
            return await currentEntitlement()
        }
    }

    @available(iOS 15.0, macOS 12.0, *)
    func restore() async -> [String: Any] {
        try? await AppStore.sync()
        return await currentEntitlement()
    }

    private func buildFreeEntitlement() -> [String: Any] {
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        let dev = deviceId
        let body = "free|0|\(now)|\(dev)"
        let sig = djb2("\(SALT):\(body)")
        return [
            "tier": "free",
            "purchasedAt": NSNull(),
            "validUntil": now,
            "deviceId": dev,
            "signature": sig
        ]
    }

    private func buildProEntitlement(purchasedAt: Int64) -> [String: Any] {
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        let dev = deviceId
        let validUntil = now + GRACE_MS
        let body = "pro|\(purchasedAt)|\(validUntil)|\(dev)"
        let sig = djb2("\(SALT):\(body)")
        return [
            "tier": "pro",
            "purchasedAt": purchasedAt,
            "validUntil": validUntil,
            "deviceId": dev,
            "signature": sig
        ]
    }
}

// MARK: - Haptics

final class HapticsManager {
    static let shared = HapticsManager()
    #if canImport(CoreHaptics)
    private var engine: CHHapticEngine?

    private init() {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }
        do {
            engine = try CHHapticEngine()
            try engine?.start()
        } catch {
            engine = nil
        }
    }

    func play(kind: String) {
        guard let engine = engine else { return }
        let intensity: Float
        let sharpness: Float
        switch kind {
        case "pin":   intensity = 0.8; sharpness = 0.6
        case "snap":  intensity = 0.4; sharpness = 0.7
        case "edge":  intensity = 0.25; sharpness = 0.4
        default:      intensity = 0.4; sharpness = 0.5
        }
        let params: [CHHapticEventParameter] = [
            CHHapticEventParameter(parameterID: .hapticIntensity, value: intensity),
            CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpness)
        ]
        let event = CHHapticEvent(eventType: .hapticTransient, parameters: params, relativeTime: 0)
        do {
            let pattern = try CHHapticPattern(events: [event], parameters: [])
            let player = try engine.makePlayer(with: pattern)
            try player.start(atTime: 0)
        } catch {
            // silent
        }
    }
    #else
    private init() {}
    func play(kind: String) {}
    #endif
}

// MARK: - Request Handler

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem
        let message: [String: Any]?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey] as? [String: Any]
        } else {
            message = request?.userInfo?["message"] as? [String: Any]
        }

        Task {
            let responseData = await handle(message: message)
            let response = NSExtensionItem()
            if #available(iOS 15.0, macOS 11.0, *) {
                response.userInfo = [SFExtensionMessageKey: responseData]
            } else {
                response.userInfo = ["message": responseData]
            }
            context.completeRequest(returningItems: [response], completionHandler: nil)
        }
    }

    private func handle(message: [String: Any]?) async -> [String: Any] {
        guard let type = message?["type"] as? String else {
            return ["ok": false, "error": "missing type"]
        }
        switch type {
        case "get-entitlement":
            if #available(iOS 15.0, macOS 12.0, *) {
                let e = await EntitlementManager.shared.currentEntitlement()
                return ["ok": true, "entitlement": e]
            }
            return ["ok": true, "entitlement": NSNull()]
        case "purchase-pro":
            if #available(iOS 15.0, macOS 12.0, *) {
                let e = await EntitlementManager.shared.purchase()
                return ["ok": true, "entitlement": e]
            }
            return ["ok": false, "error": "unsupported platform"]
        case "restore-purchases":
            if #available(iOS 15.0, macOS 12.0, *) {
                let e = await EntitlementManager.shared.restore()
                return ["ok": true, "entitlement": e]
            }
            return ["ok": false, "error": "unsupported platform"]
        case "haptic":
            let kind = (message?["kind"] as? String) ?? "snap"
            HapticsManager.shared.play(kind: kind)
            return ["ok": true]
        default:
            os_log(.default, "WSM: unknown message type %@", type)
            return ["ok": false, "error": "unknown type"]
        }
    }
}
