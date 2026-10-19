/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Key,
  Clock,
  Link as LinkIcon,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Smartphone,
  Code,
  FileText,
  Calendar,
  Globe,
  Lock,
  Plus,
  Trash2,
  Edit3,
  X,
  Check,
  Copy,
  ArrowUpRight,
  Radio,
  UserCheck,
  LogOut,
  Layers
} from 'lucide-react';

interface ExamItem {
  id: string;
  examTitle: string;
  subject: string;
  googleFormUrl: string;
  durationMinutes: number;
  pinMasuk: string;
  pinKeluar: string;
  pinPengawas: string;
  startTime: string;
  endTime: string;
  timezone: 'WIB' | 'WITA' | 'WIT';
  status: 'draft' | 'active' | 'closed';
  allowedClasses: string[];
  createdAt: string;
  updatedAt: string;
}

export default function App() {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'exams' | 'student-api' | 'ai-helper'>('exams');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingExam, setEditingExam] = useState<ExamItem | null>(null);

  // Form state inside modal
  const [formData, setFormData] = useState<Partial<ExamItem>>({
    examTitle: '',
    subject: '',
    googleFormUrl: '',
    durationMinutes: 90,
    pinMasuk: '1234',
    pinKeluar: '5678',
    pinPengawas: '9988',
    startTime: new Date().toISOString().slice(0, 16),
    endTime: new Date(Date.now() + 7200000).toISOString().slice(0, 16),
    timezone: 'WIB',
    status: 'draft',
    allowedClasses: ['Semua Kelas XII']
  });

  // Student simulation states
  const [selectedSimExamId, setSelectedSimExamId] = useState<string>('');
  const [simPinInput, setSimPinInput] = useState('');
  const [simPinType, setSimPinType] = useState<'masuk' | 'keluar' | 'pengawas'>('masuk');
  const [simResult, setSimResult] = useState<{ success: boolean; message: string; formUrl?: string | null } | null>(null);
  const [simActiveForm, setSimActiveForm] = useState<boolean>(false);

  // AI Assistant states
  const [aiGenerating, setAiGenerating] = useState<boolean>(false);
  const [aiGuidelines, setAiGuidelines] = useState<string>('');
  const [aiSelectedExamId, setAiSelectedExamId] = useState<string>('');

  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Copy state
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/exams');
      const data = await res.json();
      if (data.success) {
        setExams(data.data);
        if (data.data.length > 0 && !selectedSimExamId) {
          setSelectedSimExamId(data.data[0].id);
          setAiSelectedExamId(data.data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load exams", err);
      setMessage({ text: "Gagal memuat data ujian dari server.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const formatAMPM = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    const day = date.getDate();
    const month = date.toLocaleString('id-ID', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}, ${hours}:${minutesStr} ${ampm}`;
  };

  const handleOpenAddModal = () => {
    setEditingExam(null);
    setFormData({
      examTitle: 'Ujian Baru',
      subject: 'Mata Pelajaran',
      googleFormUrl: 'https://docs.google.com/forms/d/e/.../viewform?embedded=true',
      durationMinutes: 90,
      pinMasuk: Math.floor(1000 + Math.random() * 9000).toString(),
      pinKeluar: Math.floor(1000 + Math.random() * 9000).toString(),
      pinPengawas: Math.floor(1000 + Math.random() * 9000).toString(),
      startTime: new Date().toISOString().slice(0, 16),
      endTime: new Date(Date.now() + 7200000).toISOString().slice(0, 16),
      timezone: 'WIB',
      status: 'draft',
      allowedClasses: ['Semua Kelas']
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (exam: ExamItem) => {
    setEditingExam(exam);
    setFormData({ ...exam });
    setIsModalOpen(true);
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const url = editingExam ? `/api/exams/${editingExam.id}` : '/api/exams';
      const method = editingExam ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: editingExam ? "Ujian berhasil diperbarui!" : "Ujian baru berhasil ditambahkan!", type: 'success' });
        setIsModalOpen(false);
        fetchExams();
        setTimeout(() => setMessage(null), 4000);
      } else {
        setMessage({ text: data.message || "Gagal menyimpan ujian", type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: "Terjadi kesalahan jaringan.", type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExam = async (id: string) => {
    try {
      const res = await fetch(`/api/exams/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: "Ujian berhasil dihapus.", type: 'success' });
        setDeleteConfirmId(null);
        fetchExams();
        setTimeout(() => setMessage(null), 4000);
      } else {
        setMessage({ text: data.message || "Gagal menghapus", type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: "Kesalahan jaringan saat menghapus.", type: 'error' });
    }
  };

  const generateRandomPin = (field: 'pinMasuk' | 'pinKeluar' | 'pinPengawas') => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    setFormData({ ...formData, [field]: pin });
  };

  const handleSimVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/student/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId: selectedSimExamId, pin: simPinInput, type: simPinType }),
      });
      const data = await res.json();
      setSimResult(data);
      if (data.success && (simPinType === 'masuk' || simPinType === 'pengawas')) {
        setSimActiveForm(true);
      }
    } catch (err) {
      setSimResult({ success: false, message: "Kesalahan jaringan saat verifikasi PIN." });
    }
  };

  const handleGenerateGuidelines = async () => {
    const targetExam = exams.find(e => e.id === aiSelectedExamId) || exams[0];
    if (!targetExam) return;

    try {
      setAiGenerating(true);
      const res = await fetch('/api/ai/generate-guidelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: targetExam.subject,
          examTitle: targetExam.examTitle,
          durationMinutes: targetExam.durationMinutes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAiGuidelines(data.guidelines);
      } else {
        setMessage({ text: data.message || "Gagal membuat panduan AI", type: 'error' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mb-4" />
        <p className="text-sm font-medium">Memuat Daftar Ujian & Google Form...</p>
      </div>
    );
  }

  const selectedSimExam = exams.find(e => e.id === selectedSimExamId) || exams[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Admin Ujian & Google Form</h1>
            <p className="text-xs text-slate-400">Manajemen Link Google Form & 3 Jenis PIN (4 Digit Angka)</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Ujian Baru</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-8">
        {/* Notification Banner */}
        {message && (
          <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('exams')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'exams'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Daftar Ujian & PIN ({exams.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('student-api')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'student-api'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Simulasi & API Siswa</span>
          </button>

          <button
            onClick={() => setActiveTab('ai-helper')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'ai-helper'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Asisten AI Tata Tertib</span>
          </button>
        </div>

        {/* Tab 1: Daftar Ujian & 3 PIN Terpadu */}
        {activeTab === 'exams' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Daftar Sesi Ujian & Google Form</h2>
                <p className="text-xs text-slate-400">Setiap ujian dilengkapi dengan Link Google Form, Jadwal (AM/PM), dan 3 Jenis PIN (masing-masing 4 digit angka).</p>
              </div>
            </div>

            {exams.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                <p className="text-sm font-medium mb-1">Belum ada jadwal ujian</p>
                <p className="text-xs text-slate-500 mb-4">Klik tombol "Tambah Ujian Baru" untuk mulai membuat ujian.</p>
                <button
                  onClick={handleOpenAddModal}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
                >
                  Tambah Ujian Sekarang
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {exams.map((exam) => (
                  <div
                    key={exam.id}
                    className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-sm hover:border-slate-700 transition-all flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center"
                  >
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs font-mono px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-emerald-400">
                          {exam.id}
                        </span>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          exam.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : exam.status === 'draft'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-red-500/10 text-red-400 border border-red-500/30'
                        }`}>
                          {exam.status === 'active' ? 'Aktif' : exam.status === 'draft' ? 'Draft' : 'Selesai'}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{exam.timezone}</span>
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-white mb-0.5">{exam.examTitle}</h3>
                        <p className="text-xs text-slate-400">{exam.subject} • Durasi: {exam.durationMinutes} Menit</p>
                      </div>

                      {/* Schedule AM/PM Display */}
                      <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800/80 w-fit">
                        <Clock className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Mulai: <strong className="text-white">{formatAMPM(exam.startTime)}</strong></span>
                        <span className="text-slate-600">|</span>
                        <span>Selesai: <strong className="text-white">{formatAMPM(exam.endTime)}</strong></span>
                      </div>

                      {/* Google Form Link */}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-slate-500">Google Form:</span>
                        <a
                          href={exam.googleFormUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-emerald-400 hover:underline truncate max-w-md flex items-center gap-1 font-mono"
                        >
                          <span>{exam.googleFormUrl}</span>
                          <ArrowUpRight className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    </div>

                    {/* 3 PIN Badges (4-digit) & Actions */}
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-800">
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-slate-950 px-3 py-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-500 block mb-0.5 font-medium">PIN Masuk</span>
                          <span className="text-xs font-mono font-bold text-emerald-400 tracking-wider">{exam.pinMasuk}</span>
                        </div>
                        <div className="bg-slate-950 px-3 py-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-500 block mb-0.5 font-medium">PIN Keluar</span>
                          <span className="text-xs font-mono font-bold text-amber-400 tracking-wider">{exam.pinKeluar}</span>
                        </div>
                        <div className="bg-slate-950 px-3 py-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-500 block mb-0.5 font-medium">PIN Pengawas</span>
                          <span className="text-xs font-mono font-bold text-blue-400 tracking-wider">{exam.pinPengawas}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEditModal(exam)}
                          className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors"
                          title="Edit Ujian & PIN"
                        >
                          <Edit3 className="w-4 h-4 text-emerald-400" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(exam.id)}
                          className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors"
                          title="Hapus Ujian"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Hapus</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Simulasi & API Siswa */}
        {activeTab === 'student-api' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Student Simulator */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>Simulasi Aplikasi Siswa</span>
                </h3>
                <select
                  value={selectedSimExamId}
                  onChange={(e) => setSelectedSimExamId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                >
                  {exams.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.examTitle} ({ex.subject})</option>
                  ))}
                </select>
              </div>

              {!simActiveForm ? (
                <div className="flex-1 flex flex-col justify-center py-6">
                  {selectedSimExam && (
                    <div className="text-center max-w-sm mx-auto mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-emerald-400 mx-auto mb-3">
                        <Lock className="w-6 h-6" />
                      </div>
                      <h4 className="text-base font-semibold text-white mb-1">{selectedSimExam.examTitle}</h4>
                      <p className="text-xs text-slate-400">{selectedSimExam.subject} • {selectedSimExam.durationMinutes} Menit</p>
                      <p className="text-[11px] text-emerald-400 mt-1">Mulai: {formatAMPM(selectedSimExam.startTime)}</p>
                    </div>
                  )}

                  <form onSubmit={handleSimVerifyPin} className="space-y-4 max-w-sm mx-auto w-full">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Pilih Verifikasi PIN (4 Digit)</label>
                      <select
                        value={simPinType}
                        onChange={(e) => setSimPinType(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 mb-3"
                      >
                        <option value="masuk">PIN Masuk Ujian (4 Digit)</option>
                        <option value="keluar">PIN Keluar (4 Digit)</option>
                        <option value="pengawas">PIN Pengawas (4 Digit)</option>
                      </select>

                      <input
                        type="text"
                        maxLength={4}
                        placeholder="Masukkan 4 Digit PIN"
                        value={simPinInput}
                        onChange={(e) => setSimPinInput(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center font-mono text-lg tracking-widest text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>

                    {simResult && (
                      <div className={`p-3 rounded-xl text-xs ${simResult.success ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border border-red-500/30 text-red-300'}`}>
                        {simResult.message}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow transition-all"
                    >
                      Verifikasi & Masuk Ujian
                    </button>
                  </form>

                  {selectedSimExam && (
                    <div className="mt-6 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 text-center">
                      Petunjuk Guru (Testing): PIN Masuk = <code className="text-emerald-400 font-mono">{selectedSimExam.pinMasuk}</code> | PIN Keluar = <code className="text-amber-400 font-mono">{selectedSimExam.pinKeluar}</code>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                    <div>
                      <h4 className="text-xs font-semibold text-white">Sesi Ujian Siswa Berjalan</h4>
                      <p className="text-[11px] text-emerald-400">Google Form terhubung dengan aman</p>
                    </div>
                    <button
                      onClick={() => { setSimActiveForm(false); setSimResult(null); setSimPinInput(''); }}
                      className="px-3 py-1.5 bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30 rounded-lg text-xs font-medium transition-colors"
                    >
                      Keluar / Selesai
                    </button>
                  </div>

                  <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden min-h-[350px] flex items-center justify-center relative">
                    <div className="text-center p-6">
                      <FileText className="w-12 h-12 text-emerald-500 mx-auto mb-3 animate-bounce" />
                      <h5 className="text-sm font-semibold text-white mb-1">Google Form Ujian</h5>
                      <p className="text-xs text-slate-400 max-w-xs mx-auto mb-4 truncate">{selectedSimExam?.googleFormUrl}</p>
                      <a
                        href={selectedSimExam?.googleFormUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors"
                      >
                        <span>Buka Google Form di Tab Baru</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: API Documentation */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                <Code className="w-4 h-4 text-emerald-400" />
                <span>API Endpoint untuk Aplikasi Siswa</span>
              </h3>

              <p className="text-xs text-slate-400 mb-4">
                Aplikasi klien siswa (Android/Web) dapat mengakses data ujian berdasarkan ID Ujian.
              </p>

              <div className="space-y-4 flex-1">
                <div>
                  <span className="text-[11px] font-semibold text-slate-300 block mb-1">1. Ambil Data Ujian (GET)</span>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto">
                    GET {window.location.origin}/api/student/exam?id={selectedSimExamId}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-300 block mb-1">2. Verifikasi PIN Siswa (POST)</span>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto">
                    <span className="text-purple-400">POST</span> {window.location.origin}/api/student/verify-pin<br/>
                    <span className="text-slate-500">{`{ "examId": "${selectedSimExamId}", "pin": "4821", "type": "masuk" }`}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Asisten AI */}
        {activeTab === 'ai-helper' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  <span>Asisten AI - Pembuat Tata Tertib Ujian</span>
                </h2>
                <p className="text-xs text-slate-400">Pilih ujian untuk dibuatkan tata tertib dan petunjuk pengisian secara otomatis.</p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <select
                  value={aiSelectedExamId}
                  onChange={(e) => setAiSelectedExamId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                >
                  {exams.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.examTitle}</option>
                  ))}
                </select>

                <button
                  onClick={handleGenerateGuidelines}
                  disabled={aiGenerating}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow transition-all disabled:opacity-50 shrink-0"
                >
                  {aiGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>{aiGenerating ? 'Menyusun...' : 'Generate'}</span>
                </button>
              </div>
            </div>

            {aiGuidelines ? (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                {aiGuidelines}
              </div>
            ) : (
              <div className="bg-slate-950 border border-slate-800 border-dashed rounded-xl p-12 text-center text-slate-500">
                <FileText className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                <p className="text-xs">Klik tombol "Generate" untuk membuat panduan ujian profesional.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add / Edit Exam Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                <span>{editingExam ? 'Edit Sesi Ujian & PIN (4 Digit)' : 'Tambah Ujian & PIN (4 Digit)'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExam} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Nama / Judul Ujian</label>
                <input
                  type="text"
                  value={formData.examTitle || ''}
                  onChange={(e) => setFormData({ ...formData, examTitle: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  placeholder="Contoh: Ujian Akhir Semester Ganjil"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Mata Pelajaran</label>
                  <input
                    type="text"
                    value={formData.subject || ''}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                    placeholder="Contoh: Matematika"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Durasi (Menit)</label>
                  <input
                    type="number"
                    value={formData.durationMinutes || 90}
                    onChange={(e) => setFormData({ ...formData, durationMinutes: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                    min="10"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Link URL Google Form</label>
                <input
                  type="url"
                  value={formData.googleFormUrl || ''}
                  onChange={(e) => setFormData({ ...formData, googleFormUrl: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  placeholder="https://docs.google.com/forms/d/e/.../viewform?embedded=true"
                  required
                />
              </div>

              {/* 3 Jenis PIN Section (4 Digit) */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Pengaturan 3 Jenis PIN (4 Digit Angka)</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* PIN Masuk */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">PIN Masuk (4 Digit)</label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="1234"
                        value={formData.pinMasuk || ''}
                        onChange={(e) => setFormData({ ...formData, pinMasuk: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-center font-mono text-base font-bold text-emerald-400 tracking-widest"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => generateRandomPin('pinMasuk')}
                        className="px-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300"
                        title="Acak 4 Digit PIN"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* PIN Keluar */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">PIN Keluar (4 Digit)</label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="5678"
                        value={formData.pinKeluar || ''}
                        onChange={(e) => setFormData({ ...formData, pinKeluar: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-center font-mono text-base font-bold text-amber-400 tracking-widest"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => generateRandomPin('pinKeluar')}
                        className="px-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300"
                        title="Acak 4 Digit PIN"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* PIN Pengawas */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">PIN Pengawas (4 Digit)</label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="9988"
                        value={formData.pinPengawas || ''}
                        onChange={(e) => setFormData({ ...formData, pinPengawas: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-center font-mono text-base font-bold text-blue-400 tracking-widest"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => generateRandomPin('pinPengawas')}
                        className="px-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300"
                        title="Acak 4 Digit PIN"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule & Timezone with AM/PM preview */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Jam Mulai</label>
                    <input
                      type="datetime-local"
                      value={formData.startTime || ''}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
                      required
                    />
                    <span className="text-[10px] text-emerald-400 mt-1 block">Format: {formatAMPM(formData.startTime || '')}</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Jam Selesai</label>
                    <input
                      type="datetime-local"
                      value={formData.endTime || ''}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
                      required
                    />
                    <span className="text-[10px] text-emerald-400 mt-1 block">Format: {formatAMPM(formData.endTime || '')}</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Zona Waktu</label>
                    <select
                      value={formData.timezone || 'WIB'}
                      onChange={(e) => setFormData({ ...formData, timezone: e.target.value as any })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
                    >
                      <option value="WIB">WIB</option>
                      <option value="WITA">WITA</option>
                      <option value="WIT">WIT</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Status Ujian</label>
                <select
                  value={formData.status || 'draft'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100"
                >
                  <option value="draft">Draft (Belum Dipublikasi)</option>
                  <option value="active">Aktif (Siswa Dapat Mengakses)</option>
                  <option value="closed">Selesai / Ditutup</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow transition-all"
                >
                  {saving ? 'Menyimpan...' : (editingExam ? 'Simpan Perubahan' : 'Tambah Ujian')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-white mb-1">Hapus Ujian?</h3>
              <p className="text-xs text-slate-400">
                Tindakan ini tidak dapat dibatalkan. Ujian dan PIN yang terkait akan dihapus secara permanen.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeleteExam(deleteConfirmId)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold shadow transition-all"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-slate-950 py-6 text-center text-xs text-slate-500">
        Panel Admin Ujian CBT • Google Form & 3 PIN (4 Digit) • Didukung oleh Google AI Studio
      </footer>
    </div>
  );
}
