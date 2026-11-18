// Select an advertised Quartz mode on the disposable Actions runner.
import CoreGraphics
let screen = CGMainDisplayID()
if let choices = CGDisplayCopyAllDisplayModes(screen, nil) as? [CGDisplayMode] {
    let suitable = choices.filter { $0.isUsableForDesktopGUI() && $0.width >= 1567 && $0.height >= 1020 }
    if let selected = suitable.min(by: { $0.width * $0.height < $1.width * $1.height }) {
        let result = CGDisplaySetDisplayMode(screen, selected, nil)
        print("Quartz mode", selected.width, selected.height, "result", result.rawValue)
    } else {
        print("Available Quartz modes", choices.map { [$0.width, $0.height] })
    }
}
