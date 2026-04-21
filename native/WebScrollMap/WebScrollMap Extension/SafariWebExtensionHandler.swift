//
//  SafariWebExtensionHandler.swift
//  WebScrollMap Extension
//
//  레거시 Entitlement 호환만 처리 (tier 제거됨).
//  Extension (JS) → browser.runtime.sendNativeMessage → 여기.
//

import SafariServices
import StoreKit
import os.log

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

private func fnv1a(_ str: String) -> UInt32 {
    var h: UInt32 = 0x811c9dc5
    for u in str.unicodeScalars {
        h ^= u.value
        h = h &+ (h << 1) &+ (h << 4) &+ (h << 7) &+ (h << 8) &+ (h << 24)
    }
    return h
}

/// 64bit 합성 서명 — JS `sign64`와 동일 포맷. salt(UInt32) hex 문자열 사용.
/// 8-char zero-padding으로 JS와 길이 일치 보장.
private func sign64(_ body: String, salt: UInt32) -> String {
    let s = String(format: "%08x", salt)
    let a = djb2("\(s):\(body)")
    let b = fnv1a("\(s)#\(body)")
    return String(format: "%08x-%08x", a, b)
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
    func purchase() async -> (entitlement: [String: Any], error: String?) {
        do {
            let products = try await Product.products(for: [PRODUCT_ID])
            guard let product = products.first else {
                return (await currentEntitlement(), "product-not-available")
            }
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                if case .verified(let transaction) = verification {
                    await transaction.finish()
                    let purchasedAt = Int64(transaction.originalPurchaseDate.timeIntervalSince1970 * 1000)
                    return (buildProEntitlement(purchasedAt: purchasedAt), nil)
                }
                return (await currentEntitlement(), "verification-failed")
            case .userCancelled:
                return (await currentEntitlement(), "user-cancelled")
            case .pending:
                return (await currentEntitlement(), "pending")
            @unknown default:
                return (await currentEntitlement(), "unknown-result")
            }
        } catch {
            return (await currentEntitlement(), "\(error)")
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
        let sig = sign64(body, salt: SALT)
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
        let sig = sign64(body, salt: SALT)
        return [
            "tier": "pro",
            "purchasedAt": purchasedAt,
            "validUntil": validUntil,
            "deviceId": dev,
            "signature": sig
        ]
    }
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
                let r = await EntitlementManager.shared.purchase()
                if let err = r.error {
                    os_log(.default, "WSM purchase failed: %@", err)
                    return ["ok": false, "error": err, "entitlement": r.entitlement]
                }
                return ["ok": true, "entitlement": r.entitlement]
            }
            return ["ok": false, "error": "unsupported platform"]
        case "restore-purchases":
            if #available(iOS 15.0, macOS 12.0, *) {
                let e = await EntitlementManager.shared.restore()
                return ["ok": true, "entitlement": e]
            }
            return ["ok": false, "error": "unsupported platform"]
        default:
            os_log(.default, "WSM: unknown message type %@", type)
            return ["ok": false, "error": "unknown type"]
        }
    }
}
