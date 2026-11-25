// Use the visible filename in the actual NSOpenPanel on the hosted Mac.
import AppKit
import CoreGraphics
import Vision

let eventSource = CGEventSource(stateID: .combinedSessionState)
func key(_ code: CGKeyCode, _ flags: CGEventFlags = []) {
    for down in [true, false] {
        let event = CGEvent(keyboardEventSource: eventSource, virtualKey: code, keyDown: down)!
        event.flags = flags
        event.post(tap: .cghidEventTap)
        Thread.sleep(forTimeInterval: 0.08)
    }
}

func doubleClick(_ point: CGPoint) {
    for click in 1...2 {
        for type in [CGEventType.leftMouseDown, .leftMouseUp] {
            let event = CGEvent(mouseEventSource: eventSource, mouseType: type,
                                mouseCursorPosition: point, mouseButton: .left)!
            event.setIntegerValueField(.mouseEventClickState, value: Int64(click))
            event.post(tap: .cghidEventTap)
            Thread.sleep(forTimeInterval: 0.05)
        }
    }
}

if CommandLine.arguments[1] == "cancel" {
    key(53)
} else {
    let screenshot = URL(fileURLWithPath: CommandLine.arguments[2])
    let screen = CGDisplayBounds(CGMainDisplayID())
    for _ in 0..<6 {
        let capture = Process()
        capture.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
        capture.arguments = ["-x", screenshot.path]
        try capture.run()
        capture.waitUntilExit()
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        try VNImageRequestHandler(url: screenshot).perform([request])
        for item in request.results ?? [] {
            let label = item.topCandidates(1).first?.string ?? ""
            if label == "Wasser" || label == "Wasser.docx" {
                let box = item.boundingBox
                doubleClick(CGPoint(x: screen.minX + box.midX * screen.width,
                                    y: screen.minY + (1-box.midY) * screen.height))
                exit(0)
            }
        }
        Thread.sleep(forTimeInterval: 0.4)
    }
    throw NSError(domain: "Studio-Abnahme: Wasser.docx im Dateidialog nicht sichtbar", code: 1)
}
