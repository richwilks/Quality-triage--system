'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

type Project = { id: string; name: string }
type Partner = { id: string; full_name: string | null; company_name: string | null }

type DetectedDefect = {
  description: string
  confidence: number
  standard_reference: string
  box: { x: number; y: number; width: number; height: number }
}

type Frame = { time: number; dataUrl: string; blob: Blob }

type ReviewItem = DetectedDefect & {
  localId: string
  title: string
  included: boolean
  frameIndex: number
}

const BOX_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899']
const FRAME_COUNT = 6

function seekTo(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve) => {
    const handler = () => {
      video.removeEventListener('seeked', handler)
      resolve()
    }
    video.addEventListener('seeked', handler)
    video.currentTime = time
  })
}

function extractFrames(file: File, frameCount: number): Promise<Frame[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.src = URL.createObjectURL(file)

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('No canvas context')

        const frames: Frame[] = []
        for (let i = 0; i < frameCount; i++) {
          const t = (duration / (frameCount + 1)) * (i + 1)
          await seekTo(video, t)
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
          const blob: Blob = await new Promise((res) =>
            canvas.toBlob((b) => res(b as Blob), 'image/jpeg', 0.85)
          )
          frames.push({ time: t, dataUrl, blob })
        }
        resolve(frames)
      } catch (err) {
        reject(err)
      }
    }
    video.onerror = () => reject(new Error('Could not read video'))
  })
}

export default function NewDefectVideoPage() {
  const supabase = createClient()

  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [partners, setPartners] = useState<Partner[]>([])
  const [assignedPartnerId, setAssignedPartnerId] = useState('')
  const [location, setLocation] = useState('')
  const [targetDate, setTargetDate] = useState('')

  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [frames, setFrames] = useState<Frame[]>([])
  const [items, setItems] = useState<ReviewItem[]>([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState('')
  const [framesDone, setFramesDone] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState
