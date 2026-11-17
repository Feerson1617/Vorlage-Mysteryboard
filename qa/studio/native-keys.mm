// QA only: resolve synthesized native key events through the running app's
// normal AppKit application dispatch. This addon is not shipped in Studio.
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
    CGEventRef quartz = CGEventCreateKeyboardEvent(nullptr, key[0] == 'o' ? 31 : 1, true);
    CGEventSetFlags(quartz, kCGEventFlagMaskCommand | (shift ? kCGEventFlagMaskShift : 0));
    NSEvent *event = [NSEvent eventWithCGEvent:quartz];
    NSMutableArray *items = [NSMutableArray array];
    for (NSMenuItem *top in NSApp.mainMenu.itemArray)
      for (NSMenuItem *item in top.submenu.itemArray)
        if (item.keyEquivalent.length)
          [items addObject:@{@"title":item.title, @"key":item.keyEquivalent,
            @"flags":@(item.keyEquivalentModifierMask), @"enabled":@(item.enabled)}];
    NSDictionary *audit = @{@"characters":event.characters ?: @"", @"ignoringModifiers":event.charactersIgnoringModifiers ?: @"",
      @"command":@((event.modifierFlags & NSEventModifierFlagCommand) != 0),
      @"shift":@((event.modifierFlags & NSEventModifierFlagShift) != 0),
      @"keyCode":@(event.keyCode), @"menu":items};
    NSData *data = [NSJSONSerialization dataWithJSONObject:audit options:0 error:nil];
    [NSApp sendEvent:event];
    CFRelease(quartz);
    napi_value result;
    napi_create_string_utf8(env, static_cast<const char *>(data.bytes), data.length, &result);
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
