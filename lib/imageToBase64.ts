// Resizes an image blob/file to a max dimension and returns it as a base64
// string (no data: URL prefix) suitable for the Anthropic vision API.
export function imageToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(blob)

    img.onload = () => {
      try {
        const maxDimension = 1600
        let { width, height } = img

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not process image (no canvas context)'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        const parts = dataUrl.split(',')
        if (parts.length < 2) {
          reject(new Error('File reading step: unexpected file format'))
          return
        }
        URL.revokeObjectURL(objectUrl)
        resolve(parts[1])
      } catch (err) {
        reject(new Error('File reading step: could not process this file'))
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('File reading step: could not load this image'))
    }

    img.src = objectUrl
  })
}
