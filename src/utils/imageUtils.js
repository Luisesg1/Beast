// returnFormat: "dataURL" (con prefijo, default) | "base64" (sin prefijo)
export function compressImage(file, maxWidth = 300, quality = 0.7, returnFormat = "dataURL") {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const dataURL = canvas.toDataURL("image/jpeg", quality);
      resolve(returnFormat === "base64" ? dataURL.split(",")[1] : dataURL);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}