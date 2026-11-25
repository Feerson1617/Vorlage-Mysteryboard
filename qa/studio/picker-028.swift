// Drives the real NSOpenPanel on the macOS test runner.
import CoreGraphics
import Foundation
let source = CGEventSource(stateID: .combinedSessionState)
func key(_ code: CGKeyCode, _ flags: CGEventFlags = []) {
    for down in [true, false] {
        let event = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: down)!
        event.flags = flags
        event.post(tap: .cghidEventTap)
        Thread.sleep(forTimeInterval: 0.05)
    }
}
if CommandLine.arguments.last == "cancel" {
    key(53)
} else {
    key(5, [.maskCommand, .maskShift]) // Go to Folder
    Thread.sleep(forTimeInterval: 0.5)
    key(9, .maskCommand) // absolute fixture path on the runner clipboard
    Thread.sleep(forTimeInterval: 0.6)
    key(36)
    Thread.sleep(forTimeInterval: 0.6)
    key(36)
}
