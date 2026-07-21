'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  async function loadDataOnce() {
    if (projects.length > 0) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: projectData } = await supabase
      .from('project_members')
      .select('projects(id, name)')
      .eq('user_id', user.id)

    const projectList = (projectData || []).flatMap((row: any) =>
      Array.isArray(row.projects) ? row.projects : row.projects ? [row.projects] : []
    )
    setProjects(projectList)
    if (projectList.length > 0) setProjectId(projectList[0].id)

    const { data: partnerData } = await supabase
      .from('profiles')
      .select('id, full_name, company_name')
      .eq('role', 'partner')
    setPartners(partnerData || [])
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    await loadDataOnce()
    setVideoFile(selected)
    setFrames([])
    setItems([])
    setSaved(false)
    setError(null)
  }

  function base64FromDataUrl(dataUrl: string) {
    return dataUrl.split(',')[1]
  }

  async function handleAnalyze() {
    if (!videoFile || !projectId) return
    setProcessing(true)
    setError(null)

    try {
      setProgress('Reading video...')
      const extracted = await extractFrames(videoFile, FRAME_COUNT)
      setFrames(extracted)

      const allItems: ReviewItem[] = []
      let frameErrors = 0
      let lastErrorMessage = ''

      for (let i = 0; i < extracted.length; i++) {
        setProgress(`Analyzing frame ${i + 1} of ${extracted.length}...`)
        const base64 = base64FromDataUrl(extracted[i].dataUrl)

        const res = await fetch('/api/analyze-defect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', projectId }),
        })

        if (!res.ok) {
          frameErrors++
          try {
            const errBody = await res.json()
            lastErrorMessage = errBody.error || `status ${res.status}`
          } catch {
            lastErrorMessage = `status ${res.status}`
          }
          continue
        }
        const result: { defects: DetectedDefect[] } = await res.json()

        result.defects?.forEach((d, j) => {
          allItems.push({
            ...d,
            localId: `${i}-${j}`,
            title: `Defect ${allItems
