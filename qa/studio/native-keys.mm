// QA only: resolve synthesized native key events through the running app's
// actual AppKit menu. This file and its addon are not shipped in Studio.
#import <AppKit/AppKit.h>
#include <node_api.h>

napi_value Shortcut(napi_env env, napi_callback_info info) {
  size_t argc = 2, length = 0;
  napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  char key[8] = {};
  bool shift = false;
  if (argc != 2 || napi_get_value_string_utf8(env, args[0], key, sizeof(key), &length) != napi_ok ||
      napi_get_value_bool(env, args[1], &shift) != napi_ok || length != 1 || (key[0] != 'o' && key[0] != 's')) {
    napi_throw_type_error(env, nullptr, "Expected o/s and a Shift flag.");
    return nullptr;
  }
  @autoreleasepool {
    NSString *characters = [NSString stringWithUTF8String:key];
    if (shift) characters = characters.uppercaseString;
    NSEventModifierFlags modifiers = NSEventModifierFlagCommand | (shift ? NSEventModifierFlagShift : 0);
    NSEvent *event = [NSEvent keyEventWithType:NSEventTypeKeyDown location:NSZeroPoint
      modifierFlags:modifiers timestamp:NSProcessInfo.processInfo.systemUptime
      windowNumber:NSApp.keyWindow.windowNumber context:nil characters:characters
      charactersIgnoringModifiers:characters isARepeat:NO keyCode:key[0] == 'o' ? 31 : 1];
    const bool handled = NSApp.mainMenu && [NSApp.mainMenu performKeyEquivalent:event];
    napi_value result;
    napi_get_boolean(env, handled, &result);
    return result;
  }
}
napi_value Init(napi_env env, napi_value exports) {
  napi_value fn;
  napi_create_function(env, "shortcut", NAPI_AUTO_LENGTH, Shortcut, nullptr, &fn);
  napi_set_named_property(env, exports, "shortcut", fn);
  return exports;
}
NAPI_MODULE(studio_native_keys, Init)
