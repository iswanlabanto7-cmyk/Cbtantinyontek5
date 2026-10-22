/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
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
  Layers,
  QrCode,
  Printer,
  Download,
  ExternalLink,
  Code2,
  Smartphone,
  Cpu,
  Flame,
  LogIn,
  User as UserIcon
} from 'lucide-react';
import {
  db,
  auth,
  loginWithGoogle,
  logoutUser,
  testConnection,
  handleFirestoreError,
  OperationType
} from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';

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
  const [activeTab, setActiveTab] = useState<'exams' | 'client-api' | 'ai-helper'>('exams');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingExam, setEditingExam] = useState<ExamItem | null>(null);

  // Barcode / QR Code Modal State
  const [barcodeModalExam, setBarcodeModalExam] = useState<ExamItem | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(false);

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

  // Client API tab selected exam
  const [selectedClientApiExamId, setSelectedClientApiExamId] = useState<string>('');

  // AI Assistant states
  const [aiGenerating, setAiGenerating] = useState<boolean>(false);
  const [aiGuidelines, setAiGuidelines] = useState<string>('');
  const [aiSelectedExamId, setAiSelectedExamId] = useState<string>('');

  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Copy state
  const [copied, setCopied] = useState<string | null>(null);

  // Firebase State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isFirebaseSyncActive, setIsFirebaseSyncActive] = useState<boolean>(false);

  // Initialize Firebase Auth & Test Connection
  useEffect(() => {
    testConnection();
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Real-time Firestore sync with fallback to server API
  useEffect(() => {
    let isSubscribed = true;

    try {
      const examsColRef = collection(db, 'exams');
      const unsubscribeFirestore = onSnapshot(
        examsColRef,
        (snapshot) => {
          if (!isSubscribed) return;
          if (!snapshot.empty) {
            const list: ExamItem[] = [];
            snapshot.forEach((docSnap) => {
              list.push(docSnap.data() as ExamItem);
            });
            // Sort by createdAt descending
            list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
            setExams(list);
            setIsFirebaseSyncActive(true);
            setLoading(false);

            if (list.length > 0) {
              setAiSelectedExamId((prev) => prev || list[0].id);
              setSelectedClientApiExamId((prev) => prev || list[0].id);
            }
          } else {
            // Firestore is empty initially, load from server and seed
            fetchExamsFallback();
          }
        },
        (error) => {
          console.warn("Firestore onSnapshot error, fallback ke REST API:", error);
          setIsFirebaseSyncActive(false);
          fetchExamsFallback();
        }
      );

      return () => {
        isSubscribed = false;
        unsubscribeFirestore();
      };
    } catch (err) {
      console.warn("Error setting up Firestore listener:", err);
      fetchExamsFallback();
    }
  }, []);

  const fetchExamsFallback = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/exams');
      const data = await res.json();
      if (data.success && data.data) {
        setExams(data.data);
        if (data.data.length > 0) {
          setAiSelectedExamId((prev) => prev || data.data[0].id);
          setSelectedClientApiExamId((prev) => prev || data.data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load exams", err);
      setMessage({ text: "Gagal memuat data ujian.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Generate QR Code with Client App JSON payload (Google Form URL & 3 PINs)
  useEffect(() => {
    if (!barcodeModalExam) return;

    const generateCode = async () => {
      try {
        setIsGeneratingQr(true);
        const targetContent = JSON.stringify({
          app: "EXAMCBT",
          id: barcodeModalExam.id,
          examTitle: barcodeModalExam.examTitle,
          subject: barcodeModalExam.subject,
          googleFormUrl: barcodeModalExam.googleFormUrl,
          pinMasuk: barcodeModalExam.pinMasuk,
          pinPengawas: barcodeModalExam.pinPengawas,
          pinKeluar: barcodeModalExam.pinKeluar,
          durationMinutes: barcodeModalExam.durationMinutes,
        });

        const url = await QRCode.toDataURL(targetContent, {
          width: 400,
          margin: 2,
          errorCorrectionLevel: 'H',
          color: {
            dark: '#020617',
            light: '#ffffff'
          }
        });
        setQrDataUrl(url);
      } catch (err) {
        console.error("Failed to generate QR Code", err);
      } finally {
        setIsGeneratingQr(false);
      }
    };

    generateCode();
  }, [barcodeModalExam]);

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

  const handleOpenBarcodeModal = (exam: ExamItem) => {
    setBarcodeModalExam(exam);
  };

  const handleLoginGoogle = async () => {
    try {
      await loginWithGoogle();
      setMessage({ text: "Berhasil masuk dengan akun Google!", type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
      setMessage({ text: err.message || "Gagal login Google.", type: 'error' });
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setMessage({ text: "Berhasil keluar dari akun.", type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const examId = editingExam ? editingExam.id : (formData.id || `EXAM-${Math.floor(1000 + Math.random() * 9000)}`);
      const examData: ExamItem = {
        id: examId,
        examTitle: formData.examTitle || "Ujian Baru",
        subject: formData.subject || "Mata Pelajaran",
        googleFormUrl: formData.googleFormUrl || "",
        durationMinutes: Number(formData.durationMinutes) || 90,
        pinMasuk: formData.pinMasuk || "1234",
        pinKeluar: formData.pinKeluar || "5678",
        pinPengawas: formData.pinPengawas || "9988",
        startTime: formData.startTime || new Date().toISOString().slice(0, 16),
        endTime: formData.endTime || new Date(Date.now() + 7200000).toISOString().slice(0, 16),
        timezone: (formData.timezone as any) || "WIB",
        status: (formData.status as any) || "draft",
        allowedClasses: formData.allowedClasses || ["Semua Kelas"],
        createdAt: editingExam?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 1. Sync to Firestore
      try {
        await setDoc(doc(db, 'exams', examId), examData);
      } catch (fsErr) {
        console.warn("Firestore setDoc:", fsErr);
      }

      // 2. Sync to Server REST API
      const url = editingExam ? `/api/exams/${editingExam.id}` : '/api/exams';
      const method = editingExam ? 'PUT' : 'POST';
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(examData),
      });

      setMessage({
        text: editingExam ? "Ujian berhasil diperbarui!" : "Ujian baru berhasil disimpan ke Firestore & Server!",
        type: 'success'
      });
      setIsModalOpen(false);
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      console.error(err);
      setMessage({ text: "Terjadi kesalahan saat menyimpan data ujian.", type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExam = async (id: string) => {
    try {
      // 1. Delete from Firestore
      try {
        await deleteDoc(doc(db, 'exams', id));
      } catch (fsErr) {
        console.warn("Firestore deleteDoc:", fsErr);
      }

      // 2. Delete from REST API
      await fetch(`/api/exams/${id}`, { method: 'DELETE' });

      setMessage({ text: "Ujian berhasil dihapus dari Firestore & Server.", type: 'success' });
      setDeleteConfirmId(null);
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      console.error(err);
      setMessage({ text: "Kesalahan jaringan saat menghapus ujian.", type: 'error' });
    }
  };

  const generateRandomPin = (field: 'pinMasuk' | 'pinKeluar' | 'pinPengawas') => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    setFormData({ ...formData, [field]: pin });
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl || !barcodeModalExam) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR-Soal-${barcodeModalExam.id}.png`;
    a.click();
  };

  const handlePrintQrSheet = () => {
    window.print();
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

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mb-4" />
        <p className="text-sm font-medium">Memuat Daftar Ujian & Barcode...</p>
      </div>
    );
  }

  const selectedClientExam = exams.find(e => e.id === selectedClientApiExamId) || exams[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">EXAMCBT Admin</h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <Flame className="w-3 h-3 text-amber-400" />
                Firebase Connected
              </span>
            </div>
            <p className="text-xs text-slate-400">Penyaluran Soal Google Form & 3 Jenis PIN untuk Aplikasi Client</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Firebase Real-Time Status */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
            <span className={`w-2 h-2 rounded-full ${isFirebaseSyncActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-slate-400 text-[11px]">
              {isFirebaseSyncActive ? 'Firestore Realtime Aktif' : 'Firestore Standby'}
            </span>
          </div>

          {/* User Auth Section */}
          {currentUser ? (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="flex items-center gap-2">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || "Admin"}
                    className="w-7 h-7 rounded-full border border-emerald-500/50"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xs font-bold">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-medium text-slate-200 leading-tight">
                    {currentUser.displayName || currentUser.email?.split('@')[0]}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold leading-tight">
                    {currentUser.email === 'iswanlabanto18@guru.sma.belajar.id' ? 'Super Admin' : 'Admin Ujian'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Keluar / Logout"
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleLoginGoogle}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-all"
            >
              <LogIn className="w-3.5 h-3.5 text-amber-400" />
              <span>Login Google Admin</span>
            </button>
          )}

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Ujian</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-8 print:p-0 print:max-w-none">
        {/* Notification Banner */}
        {message && (
          <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm print:hidden ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800 print:hidden">
          <button
            onClick={() => setActiveTab('exams')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'exams'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Daftar Ujian & QR Soal ({exams.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('client-api')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'client-api'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Konfigurasi Aplikasi Client (JSON)</span>
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

        {/* Tab 1: Daftar Ujian & Barcode Soal */}
        {activeTab === 'exams' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Daftar Sesi Ujian & QR Soal Google Form</h2>
                <p className="text-xs text-slate-400">QR Code murni mengarah ke soal Google Form. PIN Masuk, PIN Pengawas, dan PIN Keluar siap ditangkap oleh aplikasi client.</p>
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
                        <span className="text-xs text-slate-500">Link Google Form:</span>
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
                      <div className="grid grid-cols-3 gap-2.5 text-center">
                        <div className="bg-slate-950 px-3 py-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-500 block mb-0.5 font-medium">PIN Masuk</span>
                          <span className="text-xs font-mono font-bold text-emerald-400 tracking-wider">{exam.pinMasuk}</span>
                        </div>
                        <div className="bg-slate-950 px-3 py-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-500 block mb-0.5 font-medium">PIN Pengawas</span>
                          <span className="text-xs font-mono font-bold text-blue-400 tracking-wider">{exam.pinPengawas}</span>
                        </div>
                        <div className="bg-slate-950 px-3 py-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-500 block mb-0.5 font-medium">PIN Keluar</span>
                          <span className="text-xs font-mono font-bold text-amber-400 tracking-wider">{exam.pinKeluar}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleOpenBarcodeModal(exam)}
                          className="px-3 py-2.5 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                          title="Tampilkan / Cetak QR Soal Google Form"
                        >
                          <QrCode className="w-4 h-4" />
                          <span>QR Soal</span>
                        </button>
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

        {/* Tab 2: Konfigurasi Aplikasi Client (JSON) */}
        {activeTab === 'client-api' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-emerald-400" />
                  <span>Pengaturan Data untuk Ditangkap Aplikasi Client</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Data Link Google Form, PIN Masuk, PIN Pengawas, dan PIN Keluar siap diambil oleh aplikasi client (Exambro / Android WebView / Flutter).
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <select
                  value={selectedClientApiExamId}
                  onChange={(e) => setSelectedClientApiExamId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                >
                  {exams.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.examTitle} ({ex.id})</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedClientExam && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Endpoint details & PIN Mapping */}
                <div className="space-y-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-300 block mb-1">Endpoint API Client (GET):</span>
                    <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto">
                      <span className="truncate">{window.location.origin}/api/client/config?id={selectedClientExam.id}</span>
                      <button
                        onClick={() => copyToClipboard(`${window.location.origin}/api/client/config?id=${selectedClientExam.id}`, 'client-api-url')}
                        className="p-1 hover:bg-slate-800 rounded text-slate-300 transition-colors ml-2 shrink-0"
                        title="Salin URL"
                      >
                        {copied === 'client-api-url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* 3 PIN Mapping for Client */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <h4 className="text-xs font-semibold text-slate-200">Variabel PIN yang Ditangkap Aplikasi Client:</h4>
                    
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <div>
                          <span className="font-mono text-emerald-400 font-bold block">pinMasuk</span>
                          <span className="text-[11px] text-slate-400">Verifikasi sebelum siswa membuka Google Form</span>
                        </div>
                        <span className="font-mono text-sm font-black text-emerald-400 px-2.5 py-1 bg-slate-950 rounded-md border border-slate-800">
                          {selectedClientExam.pinMasuk}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <div>
                          <span className="font-mono text-blue-400 font-bold block">pinPengawas</span>
                          <span className="text-[11px] text-slate-400">Buka kunci darurat / restart sesi oleh guru</span>
                        </div>
                        <span className="font-mono text-sm font-black text-blue-400 px-2.5 py-1 bg-slate-950 rounded-md border border-slate-800">
                          {selectedClientExam.pinPengawas}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <div>
                          <span className="font-mono text-amber-400 font-bold block">pinKeluar</span>
                          <span className="text-[11px] text-slate-400">Konfirmasi selesai sebelum siswa keluar dari fullscreen lock</span>
                        </div>
                        <span className="font-mono text-sm font-black text-amber-400 px-2.5 py-1 bg-slate-950 rounded-md border border-slate-800">
                          {selectedClientExam.pinKeluar}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Live JSON Payload Preview */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Code2 className="w-4 h-4 text-emerald-400" />
                      <span>Respon JSON Client (Live Data)</span>
                    </span>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify({
                        success: true,
                        data: {
                          id: selectedClientExam.id,
                          examTitle: selectedClientExam.examTitle,
                          subject: selectedClientExam.subject,
                          googleFormUrl: selectedClientExam.googleFormUrl,
                          pinMasuk: selectedClientExam.pinMasuk,
                          pinPengawas: selectedClientExam.pinPengawas,
                          pinKeluar: selectedClientExam.pinKeluar,
                          durationMinutes: selectedClientExam.durationMinutes,
                          startTime: selectedClientExam.startTime,
                          endTime: selectedClientExam.endTime,
                          timezone: selectedClientExam.timezone,
                          status: selectedClientExam.status
                        }
                      }, null, 2), 'client-json')}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[11px] font-medium text-slate-300 flex items-center gap-1 transition-colors"
                    >
                      {copied === 'client-json' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copied === 'client-json' ? 'Disalin' : 'Salin JSON'}</span>
                    </button>
                  </div>

                  <pre className="text-xs font-mono text-emerald-400 bg-slate-900/90 p-3 rounded-lg overflow-x-auto flex-1 leading-relaxed">
{JSON.stringify({
  success: true,
  data: {
    id: selectedClientExam.id,
    examTitle: selectedClientExam.examTitle,
    subject: selectedClientExam.subject,
    googleFormUrl: selectedClientExam.googleFormUrl,
    pinMasuk: selectedClientExam.pinMasuk,
    pinPengawas: selectedClientExam.pinPengawas,
    pinKeluar: selectedClientExam.pinKeluar,
    durationMinutes: selectedClientExam.durationMinutes,
    startTime: selectedClientExam.startTime,
    endTime: selectedClientExam.endTime,
    timezone: selectedClientExam.timezone,
    status: selectedClientExam.status
  }
}, null, 2)}
                  </pre>
                </div>
              </div>
            )}
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
                <p className="text-xs text-slate-400">Pilih ujian untuk dibuatkan tata tertib dan petunjuk pengerjaan barcode ujian secara otomatis.</p>
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

      {/* Barcode / QR Code Modal (Google Form Only + 3 PINs) */}
      {barcodeModalExam && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 print:p-0 print:bg-white print:fixed print:inset-0 print:z-[9999]">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl overflow-y-auto max-h-[90vh] space-y-6 print:border-none print:shadow-none print:p-0 print:bg-white print:max-w-none print:max-h-none print:space-y-0">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 print:hidden">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">QR Code Soal Google Form & 3 PIN</h3>
                  <p className="text-xs text-slate-400">{barcodeModalExam.examTitle}</p>
                </div>
              </div>
              <button
                onClick={() => setBarcodeModalExam(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* QR Code & 3 PINs Display Card */}
            <div className="bg-white rounded-2xl p-6 flex flex-col items-center justify-center text-slate-950 shadow-inner">
              <div className="text-center mb-3">
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">EXAMCBT • LEMBAR SOAL UJIAN</span>
                <h4 className="text-base font-black text-slate-900 leading-tight">{barcodeModalExam.examTitle}</h4>
                <p className="text-xs text-slate-600 font-medium">{barcodeModalExam.subject} • {barcodeModalExam.durationMinutes} Menit</p>
              </div>

              {/* QR Image */}
              <div className="relative p-2 bg-white rounded-xl border-2 border-slate-900 shadow-md">
                {isGeneratingQr ? (
                  <div className="w-60 h-60 flex items-center justify-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
                  </div>
                ) : qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR Soal ${barcodeModalExam.id}`}
                    className="w-60 h-60 object-contain rounded"
                  />
                ) : (
                  <div className="w-60 h-60 flex items-center justify-center text-xs text-slate-400">
                    Gagal memuat QR Code
                  </div>
                )}
              </div>

              <div className="mt-3 text-center">
                <span className="text-[11px] text-slate-600 block mb-1">
                  Scan via scanner aplikasi client untuk menangkap link soal Google Form & 3 PIN
                </span>
                <span className="text-xs font-mono font-bold px-3 py-1 bg-slate-100 border border-slate-300 rounded-lg text-slate-800">
                  ID: {barcodeModalExam.id}
                </span>
              </div>

              {/* 3 PINs Display for Client App Lock & Proctor */}
              <div className="mt-4 w-full grid grid-cols-3 gap-2 pt-3 border-t border-slate-200 text-center">
                <div className="bg-slate-100 p-2 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 block font-semibold">PIN MASUK</span>
                  <span className="text-sm font-mono font-black text-emerald-700 tracking-wider">{barcodeModalExam.pinMasuk}</span>
                </div>
                <div className="bg-slate-100 p-2 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 block font-semibold">PIN PENGAWAS</span>
                  <span className="text-sm font-mono font-black text-blue-700 tracking-wider">{barcodeModalExam.pinPengawas}</span>
                </div>
                <div className="bg-slate-100 p-2 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 block font-semibold">PIN KELUAR</span>
                  <span className="text-sm font-mono font-black text-amber-700 tracking-wider">{barcodeModalExam.pinKeluar}</span>
                </div>
              </div>
            </div>

            {/* Actions: Download PNG, Print */}
            <div className="grid grid-cols-2 gap-3 print:hidden">
              <button
                type="button"
                onClick={handleDownloadQr}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Download QR Soal</span>
              </button>
              <button
                type="button"
                onClick={handlePrintQrSheet}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Lembar Soal</span>
              </button>
            </div>

            <div className="pt-2 text-center print:hidden">
              <p className="text-[11px] text-slate-400">
                Aplikasi client CBT dapat menangkap link soal Google Form dan 3 PIN secara otomatis melalui pemindaian QR ini atau melalui endpoint API <code className="text-emerald-400 font-mono">/api/client/config</code>.
              </p>
            </div>
          </div>
        </div>
      )}

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
      <footer className="border-t border-slate-800/60 bg-slate-950 py-6 text-center text-xs text-slate-500 print:hidden">
        EXAMCBT Admin • Penyaluran Soal Barcode & 3 PIN (4 Digit) • Didukung oleh Google AI Studio
      </footer>
    </div>
  );
}
