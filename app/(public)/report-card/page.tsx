'use client'

import { useState } from 'react'
import Link from 'next/link'

const questions = [
  {
    id: 'online_payments',
    question: 'Can owners pay dues online?',
    yes: 'Modern — owners can pay from their phone',
    no: 'Still collecting paper checks in 2026',
  },
  {
    id: 'maintenance_requests',
    question: 'Can owners submit maintenance requests online?',
    yes: 'Requests tracked digitally, nothing gets lost',
    no: 'Owners still call or email — requests get forgotten',
  },
  {
    id: 'financial_reports',
    question: 'Do board members get monthly financial reports automatically?',
    yes: 'Reports arrive on time, every month',
    no: 'Reports are late, manual, or non-existent',
  },
  {
    id: 'document_access',
    question: 'Can board members access documents without emailing the manager?',
    yes: 'Self-service document center',
    no: 'Every document requires an email chain',
  },
  {
    id: 'violation_notices',
    question: 'Are violation notices sent automatically?',
    yes: 'Automated workflow — notice to resolution',
    no: 'Manual process — inconsistent and slow',
  },
  {
    id: 'vendor_invoices',
    question: 'Can vendors submit invoices online?',
    yes: 'Digital invoice submission and tracking',
    no: 'Paper invoices or email attachments',
  },
  {
    id: 'board_portal',
    question: 'Do you have a dedicated board portal?',
    yes: 'Board members have their own dashboard',
    no: 'Board members share the manager\'s login or get PDFs',
  },
  {
    id: 'work_orders',
    question: 'Are work orders tracked digitally from request to completion?',
    yes: 'Full lifecycle tracking with status updates',
    no: 'Work orders live in spreadsheets or email',
  },
  {
    id: 'payment_history',
    question: 'Can owners view their own payment history?',
    yes: 'Owner portal with full financial visibility',
    no: 'Owners have to call to ask about their balance',
  },
  {
    id: 'response_time',
    question: 'Does your manager typically respond within 24 hours?',
    yes: 'Responsive and accountable',
    no: 'Days or weeks to hear back',
  },
]

type Grade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'

interface GradeInfo {
  grade: Grade
  label: string
  color: string
  bg: string
  emoji: string
  description: string
}

function calculateGrade(yesCount: number): GradeInfo {
  const grades: Record<number, GradeInfo> = {
    10: { grade: 'A+', label: 'World-Class', color: 'text-emerald-600', bg: 'bg-emerald-50', emoji: '🏆', description: 'Your HOA management is running at the highest level. Owners are happy, board members are informed, and nothing falls through the cracks.' },
    9: { grade: 'A', label: 'Excellent', color: 'text-emerald-600', bg: 'bg-emerald-50', emoji: '⭐', description: 'Nearly everything is running smoothly. One small gap to close, but you\'re in great shape.' },
    8: { grade: 'B', label: 'Good', color: 'text-blue-600', bg: 'bg-blue-50', emoji: '👍', description: 'Solid foundation. A few areas need attention, but your management company is doing a decent job.' },
    7: { grade: 'B', label: 'Good', color: 'text-blue-600', bg: 'bg-blue-50', emoji: '👍', description: 'Solid foundation. A few areas need attention, but your management company is doing a decent job.' },
    6: { grade: 'C', label: 'Average', color: 'text-amber-600', bg: 'bg-amber-50', emoji: '🤔', description: 'There are real gaps in how your HOA is managed. Board members and owners are probably frustrated.' },
    5: { grade: 'C', label: 'Average', color: 'text-amber-600', bg: 'bg-amber-50', emoji: '🤔', description: 'There are real gaps in how your HOA is managed. Board members and owners are probably frustrated.' },
    4: { grade: 'D', label: 'Below Average', color: 'text-orange-600', bg: 'bg-orange-50', emoji: '⚠️', description: 'Significant problems. Your management company is costing you time, money, and owner satisfaction.' },
    3: { grade: 'D', label: 'Below Average', color: 'text-orange-600', bg: 'bg-orange-50', emoji: '⚠️', description: 'Significant problems. Your management company is costing you time, money, and owner satisfaction.' },
    2: { grade: 'F', label: 'Failing', color: 'text-red-600', bg: 'bg-red-50', emoji: '🚨', description: 'Your HOA management is broken. Board members are in the dark, owners are unhappy, and critical tasks are being dropped.' },
    1: { grade: 'F', label: 'Failing', color: 'text-red-600', bg: 'bg-red-50', emoji: '🚨', description: 'Your HOA management is broken. Board members are in the dark, owners are unhappy, and critical tasks are being dropped.' },
    0: { grade: 'F', label: 'Failing', color: 'text-red-600', bg: 'bg-red-50', emoji: '🚨', description: 'Your HOA management is broken. Board members are in the dark, owners are unhappy, and critical tasks are being dropped.' },
  }
  return grades[yesCount] || grades[0]
}

export default function ReportCardPage() {
  const [answers, setAnswers] = useState<Record<string, boolean | null>>({})
  const [submitted, setSubmitted] = useState(false)

  const answeredCount = Object.values(answers).filter(v => v !== null).length
  const yesCount = Object.values(answers).filter(v => v === true).length
  const allAnswered = answeredCount === questions.length
  const gradeInfo = calculateGrade(yesCount)

  const handleAnswer = (id: string, value: boolean) => {
    if (submitted) return
    setAnswers(prev => ({ ...prev, [id]: value }))
  }

  const handleSubmit = () => {
    setSubmitted(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleReset = () => {
    setAnswers({})
    setSubmitted(false)
  }

  const failedQuestions = questions.filter(q => answers[q.id] === false)

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#060709] pb-16 pt-16 sm:pb-20 sm:pt-20">
        <div aria-hidden="true" className="pointer-events-none absolute -top-48 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full opacity-[0.12]" style={{ background: 'radial-gradient(circle, #6d8dff 0%, transparent 70%)' }} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '88px 88px' }} />
        <div className="relative mx-auto max-w-[720px] px-6 text-center">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[12px] font-medium tracking-[0.02em] text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Free Tool — No Signup Required
          </div>
          <h1 className="text-[36px] font-semibold leading-[1.08] tracking-[-0.03em] text-white sm:text-5xl">
            Grade Your HOA<br />Management Company
          </h1>
          <p className="mt-4 text-[16px] leading-7 text-zinc-400 sm:text-lg">
            10 questions. 60 seconds. Find out if your management company is earning their fees — or costing you more than you think.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-[720px] px-6 pb-24 pt-12">
        {submitted ? (
          /* RESULT CARD */
          <div>
            <div className={`rounded-2xl ${gradeInfo.bg} border p-8 sm:p-12 text-center`}>
              <div className="text-6xl mb-4">{gradeInfo.emoji}</div>
              <div className={`text-7xl font-bold tracking-[-0.04em] ${gradeInfo.color} mb-2`}>
                {gradeInfo.grade}
              </div>
              <div className={`text-xl font-semibold ${gradeInfo.color} mb-4`}>
                {gradeInfo.label}
              </div>
              <p className="text-[15px] leading-7 text-gray-600 max-w-md mx-auto">
                {gradeInfo.description}
              </p>
              <div className="mt-6 inline-flex items-center gap-3 rounded-xl bg-white px-5 py-3 shadow-sm border border-gray-100">
                <span className="text-sm text-gray-500">{yesCount} of {questions.length} passed</span>
                <span className="text-gray-300">|</span>
                <span className="text-sm text-gray-500">{questions.length - yesCount} need work</span>
              </div>
            </div>

            {/* Failed Questions */}
            {failedQuestions.length > 0 && (
              <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {failedQuestions.length === 1
                    ? "Here's what's holding you back"
                    : `Here are the ${failedQuestions.length} things holding you back`}
                </h2>
                <ul className="space-y-3">
                  {failedQuestions.map(q => (
                    <li key={q.id} className="flex items-start gap-3 text-[15px] text-gray-600">
                      <span className="mt-0.5 flex-shrink-0 h-5 w-5 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-xs font-bold">✕</span>
                      <div>
                        <span className="font-medium text-gray-800">{q.question}</span>
                        <br />
                        <span className="text-sm text-gray-500">{q.no}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* CTA */}
            <div className="mt-8 rounded-2xl border border-[#1E3A5F]/20 bg-[#1E3A5F]/[0.03] p-6 sm:p-8 text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {gradeInfo.grade === 'A+' ? 'Keep it that way with the right software' :
                 gradeInfo.grade === 'A' || gradeInfo.grade === 'B' ? 'Close the gap with better tools' :
                 'There\'s software that fixes all of this'}
              </h2>
              <p className="text-[15px] text-gray-600 mb-6 max-w-md mx-auto leading-relaxed">
                Portier369 gives your management company one platform for payments, work orders, violations, board portals, vendor management, and owner communications. Starting at $157/month.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  href="/demo"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A5F] px-6 py-3 text-[15px] font-semibold text-white hover:bg-[#162D4A] transition"
                >
                  See how Portier369 fixes this
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-[15px] font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Take it again
                </button>
              </div>
            </div>

            {/* Share Section */}
            <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Share your HOA's grade</h3>
              <p className="text-sm text-gray-500 mb-4">
                Send this to your board. Or your manager. Let them see the score.
              </p>
              <button
                onClick={() => {
                  const text = `My HOA management company just scored a ${gradeInfo.grade} on the Portier369 HOA Report Card. ${yesCount}/10 passed. Grade yours: ${window.location.href}`
                  if (navigator.share) {
                    navigator.share({ title: 'My HOA Report Card', text, url: window.location.href })
                  } else {
                    navigator.clipboard.writeText(text).then(() => alert('Copied! Share it anywhere.'))
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-[#1E3A5F]/20 bg-[#1E3A5F]/5 px-6 py-3 text-[15px] font-semibold text-[#1E3A5F] hover:bg-[#1E3A5F]/10 transition"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share result
              </button>
            </div>
          </div>
        ) : (
          /* QUESTIONNAIRE */
          <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">The 10-Question HOA Health Check</h2>
                <p className="text-sm text-gray-500 mt-1">Answer honestly. No one sees this but you.</p>
              </div>
              <div className="text-sm font-medium text-gray-400 tabular-nums">
                {answeredCount}/{questions.length}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-8 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#1E3A5F] transition-all duration-300"
                style={{ width: `${(answeredCount / questions.length) * 100}%` }}
              />
            </div>

            <div className="space-y-6">
              {questions.map((q, i) => (
                <div key={q.id} className="pb-6 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500 mt-0.5">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-[15px] font-medium text-gray-900">{q.question}</p>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleAnswer(q.id, true)}
                          className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                            answers[q.id] === true
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-200 hover:bg-emerald-50/50'
                          }`}
                        >
                          <span className="block text-xs text-gray-400 mb-0.5">YES</span>
                          {q.yes}
                        </button>
                        <button
                          onClick={() => handleAnswer(q.id, false)}
                          className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                            answers[q.id] === false
                              ? 'border-red-300 bg-red-50 text-red-700'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-red-200 hover:bg-red-50/50'
                          }`}
                        >
                          <span className="block text-xs text-gray-400 mb-0.5">NO</span>
                          {q.no}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!allAnswered}
              className={`mt-8 w-full rounded-xl px-6 py-4 text-[15px] font-semibold transition ${
                allAnswered
                  ? 'bg-[#1E3A5F] text-white hover:bg-[#162D4A] cursor-pointer'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {allAnswered
                ? `Grade My HOA — See Your Score`
                : `Answer all ${questions.length - answeredCount} remaining questions to get your grade`}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
