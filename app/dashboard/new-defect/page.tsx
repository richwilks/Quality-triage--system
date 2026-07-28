'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import MeasurementFields, { MeasurementData } from '@/components/MeasurementFields'

type Project = { id: string; name: string }
type Partner = { id: string; full_name: string | null; company_name: string | null }

type DetectedDefect = {
  description: string
  confidence: number
  standard_reference: string
  requires_measurement: boolean
  box: { x: number; y: number; width: number; height: number }
}

type ReviewItem = DetectedDefect & {
  localId: string
  title: string
  included: boolean
  measurement: MeasurementData
}

const BOX_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899']
const ESTIMATED_ANALYSIS_SECONDS = 18
const EMPTY_MEASUREMENT: MeasurementData = { measuredGapMm: '', testedDetailReference: '', manufacturerSystem: '' }

function NewDefectPageInner() {
  const supabase = createClient()
  const searchParams = useSearchParams()

  const initialProjectId = searchParams.get('projectId') || ''
  const initialLocation = searchParams.get('location') || ''
  const initialDrawingId = searchParams.get('drawingId') || ''
  const initialPinX = searchParams.get('pinX')
  const initialPinY = searchParams.get('pinY')

  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState(initialProjectId)
  const [partners, setPartners] = useState<Partner[]>([])
  const [assignedPartnerId, setAssignedPartnerId] = useState('')

  const [location, setLocation] = useState(initialLocation)
  const [finishGrade, setFinishGrade] = useState('')
  const [drawingId] = useState(initialDrawingId || null)
  const [pinX] = useState(initialPinX ? parseFloat(initialPinX) : null)
  const [pinY] = useState(initialPinY ? parseFloat(initialPinY) : null)
  const [targetDate, setTargetDate] = useState('')

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeProgress, setAnalyzeProgress] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<ReviewItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: projectData } = await supabase
        .from('project_members')
        .select('projects(id, name)')
        .eq('user_id', user.id)

      const projectList = (projectData || []).flatMap((row: any) =>
        Array.isArray(row.projects) ? row.projects : row.projects ? [row.projects] : []
      )
      setProjects(projectList)

      if (initialProjectId && projectList.some((p: Project) => p.id === initialProjectId)) {
        setProjectId(initialProjectId)
      } else if (projectList.length > 0) {
        setProjectId(projectList[0].id)
      }

      const { data: partnerData } = await supabase
        .from('profiles')
        .select('id, full_name, company_name')
        .eq('role', 'partner')

      setPartners(partnerData || [])
    }
    loadData()
  }, [])

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    }
  }, [])

  function startProgressSimulation() {
    setAnalyzeProgress(0)
    setElapsedSeconds(0)
    const startTime = Date.now()

    progressTimerRef.current = setInterval(() => {
      const secondsPassed = (Date.now() - startTime) / 1000
      setElapsedSeconds(Math.round(secondsPassed))

      const estimatedPercent = (secondsPassed / ESTIMATED_ANALYSIS_SECONDS) * 100
      const capped = Math.min(estimatedPercent, 92)
      setAnalyzeProgress(capped)
    }, 200)
  }

  function stopProgressSimulation(finished: boolean) {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    if (finished) {
      setAnalyzeProgress(100)
      setTimeout(() => setAnalyzeProgress(0), 600)
    } else {
      setAnalyzeProgress(0)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setItems([])
    setSaved(false)
    setError(null)
    setPreview(URL.createObjectURL(selected))
  }

  function fileToBase64(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const objectUrl = URL.createObjectURL(f)

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

  async function handleAnalyze() {
    if (!file || !projectId) return
    setAnalyzing(true)
    setError(null)
    startProgressSimulation()

    try {
      let base64: string
      try {
        base64 = await fileToBase64(file)
      } catch (err: any) {
        setError(
