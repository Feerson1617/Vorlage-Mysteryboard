import jsQR from "jsqr";
export function scanPixels(image: ImageData) {
  return jsQR(image.data, image.width, image.height, {
    inversionAttempts: "dontInvert",
  });
}
