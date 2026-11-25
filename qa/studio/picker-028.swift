// Use the visible filename in the actual NSOpenPanel on the hosted Mac.
import AppKit
import CoreGraphics
import Vision

let filename = CommandLine.arguments.count > 3 ? CommandLine.arguments[3] : "Wasser"
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
    // List view displays the contents even on the runner's narrow screen.
    key(19, .maskCommand)
    Thread.sleep(forTimeInterval: 0.7)
    var labels = [String]()
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
        labels = []
        for item in request.results ?? [] {
            let label = item.topCandidates(1).first?.string ?? ""
            labels.append(label)
            if label.range(of: #"\b"# + NSRegularExpression.escapedPattern(for:filename) + #"(?:\.(?:docx|mysteryboard))?\b"#, options: [.regularExpression, .caseInsensitive]) != nil {
                let box = item.boundingBox
                doubleClick(CGPoint(x: screen.minX + box.midX * screen.width,
                                    y: screen.minY + (1-box.midY) * screen.height))
                exit(0)
            }
        }
        Thread.sleep(forTimeInterval: 0.4)
    }
    FileHandle.standardError.write(Data((filename + " im Dateidialog nicht sichtbar: " + labels.joined(separator: " / ") + "\n").utf8))
    exit(1)
}
