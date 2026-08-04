  async function runBoundaryDetection(x: number, y: number) {
    if (!imgRef.current || !drawing?.image_url) return
    setDetectingBoundary(true)
    setBoundaryError(null)

    try {
      const img = imgRef.current
      const naturalW = img.naturalWidth
      const naturalH = img.naturalHeight

      const fullX = (x / 100) * naturalW
      const fullY = (y / 100) * naturalH

      // Crop a generous area around the tap - enough to see the whole room plus some wall context,
      // small enough to exclude most other similar-looking rooms that could confuse tracing
      const cropFraction = 0.4
      let cropW = naturalW * cropFraction
      let cropH = naturalH * cropFraction
      cropW = Math.min(cropW, naturalW)
      cropH = Math.min(cropH, naturalH)

      let cx = fullX - cropW / 2
      let cy = fullY - cropH / 2
      cx = Math.max(0, Math.min(cx, naturalW - cropW))
      cy = Math.max(0, Math.min(cy, naturalH - cropH))

      const canvas = document.createElement('canvas')
      canvas.width = cropW
      canvas.height = cropH
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no context')
      ctx.drawImage(img, cx, cy, cropW, cropH, 0, 0, cropW, cropH)

      // Draw a visible marker directly on the crop at the tap location
      const markerPxX = fullX - cx
      const markerPxY = fullY - cy
      const markerRadius = cropW * 0.012
      ctx.beginPath()
      ctx.arc(markerPxX, markerPxY, markerRadius, 0, 2 * Math.PI)
      ctx.fillStyle = 'rgba(220,38,38,0.9)'
      ctx.fill()
      ctx.lineWidth = markerRadius * 0.3
      ctx.strokeStyle = 'white'
      ctx.stroke()

      const markerPctX = (markerPxX / cropW) * 100
      const markerPctY = (markerPxY / cropH) * 100

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
      const base64 = dataUrl.split(',')[1]

      const res = await fetch('/api/detect-room-boundary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: 'image/jpeg',
          clickX: markerPctX,
          clickY: markerPctY,
        }),
      })
      const result = await res.json()

      if (result.boundary && result.boundary.length >= 3) {
        // Convert crop-relative percentages back to full-drawing percentages
        const fullBoundary: Point[] = result.boundary.map((p: Point) => {
          const cropPxX = (p.x / 100) * cropW
          const cropPxY = (p.y / 100) * cropH
          const fullPxX = cx + cropPxX
          const fullPxY = cy + cropPxY
          return {
            x: (fullPxX / naturalW) * 100,
            y: (fullPxY / naturalH) * 100,
          }
        })

        setDrawPoints(fullBoundary)

        // Focused label read, centred on the newly traced room, same as before
        const center = centroid(fullBoundary)
        let label = result.label || ''

        try {
          const cropCanvas = document.createElement('canvas')
          const labelCropSize = 0.18
          const labelCropW = naturalW * labelCropSize
          const labelCropH = naturalH * labelCropSize
          const lcx = (center.x / 100) * naturalW - labelCropW / 2
          const lcy = (center.y / 100) * naturalH - labelCropH / 2

          cropCanvas.width = labelCropW
          cropCanvas.height = labelCropH
          const cropCtx = cropCanvas.getContext('2d')
          if (cropCtx) {
            cropCtx.drawImage(img, lcx, lcy, labelCropW, labelCropH, 0, 0, labelCropW, labelCropH)
            const cropDataUrl = cropCanvas.toDataURL('image/jpeg', 0.9)
            const cropBase64 = cropDataUrl.split(',')[1]

            const labelRes = await fetch('/api/detect-room-label', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: cropBase64, mimeType: 'image/jpeg' }),
            })
            const labelResult = await labelRes.json()
            if (labelResult.label) {
              label = labelResult.label
            }
          }
        } catch {
          // fall back silently to whatever label the boundary call returned, if any
        }

        setRoomName(label)
      } else {
        setBoundaryError('Could not trace that room automatically - try tapping more centrally, or draw it manually below.')
      }
    } catch {
      setBoundaryError('Detection failed - try tapping more centrally, or draw it manually below.')
    } finally {
      setDetectingBoundary(false)
    }
  }
