'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Project = { id: string; name: string }
type Partner = { id: string; full_name: string | null; company_name: string | null }

type DetectedDefect = {
  description: string
  confidence: number
  standard_reference: string
  box: { x: number; y: number; width: number; height: number }
}

type ReviewItem = DetectedDefect & {
  localId: string
  title: string
  included: boolean
}

const BOX_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899']

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
  const [drawingId] = useState(initialDrawingId || null)
  const [pinX] = useState(initialPinX ? parseFloat(initialPinX) : null)
  const [pinY] = useState(initialPinY ? parseFloat(initialPinY) : null)
  const [targetDate, setTargetDate] = useState('')

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<ReviewItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

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

      const
