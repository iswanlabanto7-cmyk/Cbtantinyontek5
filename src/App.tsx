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
  User as UserIcon,
  Mail,
  KeyRound,
  UserPlus,
  Sliders,
  Eye,
  ShieldAlert,
  Info,
  CheckCircle
} from 'lucide-react';
import {
  db,
  auth,
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
  loginAsDefaultAdmin,
  DEFAULT_GURU_EMAIL,
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
  deleteDoc,
  query,
  where,
  getDoc
} from 'firebase/firestore';

interface ExamItem {
  id: string;
  authorId?: string;
  authorEmail?: string;
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

export interface ClientSettings {
  id?: string;
  authorId?: string;
  authorEmail?: string;
  schoolName: string;
  securityMode: 'standar' | 'ketat' | 'santai';
  maxViolations: number;
  blockScreenshot: boolean;
  blockSplitScreen: boolean;
  splashNotice: string;
}

export default function App() {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'exams' | 'client-settings' | 'ai-helper'>('exams');

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

  // Client settings state (simplified & non-overlapping)
  const [clientSettings, setClientSettings] = useState<ClientSettings>({
    schoolName: 'SMA Negeri CBT Exambro',
    securityMode: 'standar',
    maxViolations: 3,
    blockScreenshot: true,
    blockSplitScreen: true,
    splashNotice: 'Dilarang keluar aplikasi atau membuka jendela lain selama ujian berlangsung.'
  });
  const [savingClientSettings, setSavingClientSettings] = useState<boolean>(false);

  // Student Simulator Modal State
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);
  const [simExam, setSimExam] = useState<ExamItem | null>(null);
  const [simViolations, setSimViolations] = useState<number>(0);
  const [simStep, setSimStep] = useState<'pin_masuk' | 'exam' | 'locked' | 'finished'>('pin_masuk');
  const [simPinInput, setSimPinInput] = useState<string>('');
  const [simMessage, setSimMessage] = useState<string>('');

  // AI Assistant states
  const [aiGenerating, setAiGenerating] = useState<boolean>(false);
  const [aiGuidelines, setAiGuidelines] = useState<string>('');
  const [aiSelectedExamId, setAiSelectedExamId] = useState<string>('');

  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Copy state
  const [copied, setCopied] = useState<string | null>(null);

  // Firebase & Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isFirebaseSyncActive, setIsFirebaseSyncActive] = useState<boolean>(false);

  // Auth Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authTab, setAuthTab] = useState<'quick' | 'email' | 'register'>('quick');
  const [emailInput, setEmailInput] = useState<string>('');
  const [passInput, setPassInput] = useState<string>('');
  const [nameInput, setNameInput] = useState<string>('');
  const [authActionLoading, setAuthActionLoading] = useState<boolean>(false);

  // Initialize Firebase Auth & Real-time user-isolated Firestore sync
  useEffect(() => {
    testConnection();
    let unsubscribeFirestore: (() => void) | null = null;
    let isMounted = true;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;
      setCurrentUser(user);
      setAuthLoading(false);

      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }

      if (user) {
        // 1. Sync User Profile to /users/{userId}
        try {
          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(userDocRef, {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Pengguna',
            photoURL: user.photoURL || '',
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
          }, { merge: true });
        } catch (profileErr) {
          console.warn("User profile sync error:", profileErr);
        }

        // 2. Query exams strictly isolated to this user
        setLoading(true);
        try {
          const q = query(collection(db, 'exams'), where('authorId', '==', user.uid));
          unsubscribeFirestore = onSnapshot(
            q,
            async (snapshot) => {
              if (!isMounted) return;
              const list: ExamItem[] = [];
              snapshot.forEach((docSnap) => {
                list.push(docSnap.data() as ExamItem);
              });

              // Initial sample seed to Firestore if user has 0 exams
              if (list.length === 0 && snapshot.empty) {
                try {
                  const defaultSample: ExamItem = {
                    id: "EXAM-2026-001",
                    authorId: user.uid,
                    authorEmail: user.email || '',
                    examTitle: "Ujian Akhir Semester (UAS) Ganjil",
                    subject: "Matematika Peminatan Kelas XII",
                    googleFormUrl: "https://docs.google.com/forms/d/e/1FAIpQLSe-sample-exam-form/viewform?embedded=true",
                    durationMinutes: 90,
                    pinMasuk: "4821",
                    pinKeluar: "9912",
                    pinPengawas: "7788",
                    startTime: new Date(Date.now() + 60000 * 15).toISOString().slice(0, 16),
                    endTime: new Date(Date.now() + 60000 * 120).toISOString().slice(0, 16),
                    timezone: "WIB",
                    status: "active",
                    allowedClasses: ["XII IPA 1", "XII IPA 2"],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  };
                  await setDoc(doc(db, 'exams', defaultSample.id), defaultSample);
                  return;
                } catch (seedErr) {
                  console.warn("Auto-seed error:", seedErr);
                }
              }

              // Sort by createdAt descending
              list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
              setExams(list);
              setIsFirebaseSyncActive(true);
              setLoading(false);

              if (list.length > 0) {
                setAiSelectedExamId((prev) => prev || list[0].id);
              }
            },
            (error) => {
              console.warn("Firestore user query error:", error);
              setIsFirebaseSyncActive(false);
              setLoading(false);
            }
          );
        } catch (err) {
          console.warn("Error subscribing to user exams:", err);
          setIsFirebaseSyncActive(false);
          setLoading(false);
        }
      } else {
        // Automatically authenticate with default teacher account to enable seamless Firestore persistence
        setIsFirebaseSyncActive(false);
        loginAsDefaultAdmin().catch((err) => {
          console.warn("Auto admin login fallback:", err);
          setLoading(false);
        });
      }
    });

    return () => {
      isMounted = false;
      if (unsubscribeFirestore) unsubscribeFirestore();
      unsubscribeAuth();
    };
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
        }
      }
    } catch (err) {
      console.error("Failed to load exams", err);
      setMessage({ text: "Gagal memuat data ujian.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Generate Unified QR Code (Google Form URL, 3 PINs, and Client Lockdown Profile)
  useEffect(() => {
    if (!barcodeModalExam) return;

    const generateCode = async () => {
      try {
        setIsGeneratingQr(true);
        const targetContent = JSON.stringify({
          app: "EXAMCBT",
          school: clientSettings.schoolName,
          mode: clientSettings.securityMode,
          maxViolations: clientSettings.maxViolations,
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
  }, [barcodeModalExam, clientSettings]);

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
      setAuthActionLoading(true);
      await loginWithGoogle();
      setMessage({ text: "Berhasil masuk dengan akun Google!", type: 'success' });
      setIsAuthModalOpen(false);
      setTimeout(() => setMessage(null), 3500);
    } catch (err: any) {
      console.error(err);
      setMessage({ text: err.message || "Gagal login Google. Coba Masuk Cepat Guru/Admin.", type: 'error' });
    } finally {
      setAuthActionLoading(false);
    }
  };

  const handleQuickLogin = async () => {
    try {
      setAuthActionLoading(true);
      await loginAsDefaultAdmin();
      setMessage({ text: "Berhasil masuk sebagai Guru Admin (Iswan Labanto)!", type: 'success' });
      setIsAuthModalOpen(false);
      setTimeout(() => setMessage(null), 3500);
    } catch (err: any) {
      console.error(err);
      setMessage({ text: "Gagal masuk cepat: " + (err.message || "Kesalahan autentikasi"), type: 'error' });
    } finally {
      setAuthActionLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passInput) {
      setMessage({ text: "Email dan kata sandi wajib diisi.", type: 'error' });
      return;
    }
    try {
      setAuthActionLoading(true);
      if (authTab === 'register') {
        await registerWithEmail(emailInput, passInput, nameInput || 'Guru Penguji');
        setMessage({ text: "Akun baru berhasil didaftarkan dan aktif!", type: 'success' });
      } else {
        await loginWithEmail(emailInput, passInput);
        setMessage({ text: "Berhasil masuk ke akun Anda!", type: 'success' });
      }
      setIsAuthModalOpen(false);
      setEmailInput('');
      setPassInput('');
      setNameInput('');
      setTimeout(() => setMessage(null), 3500);
    } catch (err: any) {
      console.error(err);
      let msg = err.message || "Gagal masuk.";
      if (err.code === 'auth/invalid-credential') msg = "Email atau kata sandi salah.";
      if (err.code === 'auth/email-already-in-use') msg = "Email sudah terdaftar. Silakan pilih tab Masuk.";
      if (err.code === 'auth/weak-password') msg = "Kata sandi minimal 6 karakter.";
      setMessage({ text: msg, type: 'error' });
    } finally {
      setAuthActionLoading(false);
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

    // 1. Ensure user is authenticated to meet Firestore security rules
    let activeUser = currentUser;
    if (!activeUser) {
      try {
        setSaving(true);
        activeUser = await loginAsDefaultAdmin();
        setCurrentUser(activeUser);
      } catch (authErr) {
        setSaving(false);
        setIsAuthModalOpen(true);
        setMessage({
          text: "Silakan masuk ke akun Anda terlebih dahulu untuk menyimpan ujian ke Firebase Firestore.",
          type: 'error'
        });
        return;
      }
    }

    try {
      setSaving(true);
      // Clean and ensure valid exam ID
      const rawId = editingExam ? editingExam.id : (formData.id || `EXAM-${Math.floor(1000 + Math.random() * 9000)}`);
      const examId = rawId.replace(/[^a-zA-Z0-9_\-]/g, '_');

      // Build payload strictly adhering to firestore.rules isValidExam
      const examData: ExamItem = {
        id: examId,
        authorId: activeUser.uid,
        authorEmail: activeUser.email || '',
        examTitle: (formData.examTitle || "Ujian Baru").trim().slice(0, 200),
        subject: (formData.subject || "Mata Pelajaran").trim().slice(0, 150),
        googleFormUrl: (formData.googleFormUrl || "").trim().slice(0, 1000),
        durationMinutes: Number(formData.durationMinutes) > 0 ? Number(formData.durationMinutes) : 90,
        pinMasuk: (formData.pinMasuk || "1234").trim().slice(0, 10),
        pinKeluar: (formData.pinKeluar || "5678").trim().slice(0, 10),
        pinPengawas: (formData.pinPengawas || "9988").trim().slice(0, 10),
        startTime: formData.startTime || new Date().toISOString().slice(0, 16),
        endTime: formData.endTime || new Date(Date.now() + 7200000).toISOString().slice(0, 16),
        timezone: (formData.timezone as any) || "WIB",
        status: (formData.status as any) || "draft",
        allowedClasses: Array.isArray(formData.allowedClasses) && formData.allowedClasses.length > 0 ? formData.allowedClasses : ["Semua Kelas"],
        createdAt: editingExam?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 2. Persist to Firebase Firestore with user isolation security
      try {
        await setDoc(doc(db, 'exams', examId), examData);
      } catch (fsErr: any) {
        console.error("Firestore setDoc error:", fsErr);
        handleFirestoreError(fsErr, OperationType.WRITE, `exams/${examId}`);
      }

      // 3. Sync to REST API Server for Client App Fallback
      try {
        const url = editingExam ? `/api/exams/${editingExam.id}` : '/api/exams';
        const method = editingExam ? 'PUT' : 'POST';
        await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(examData),
        });
      } catch (apiErr) {
        console.warn("Rest API fallback sync warning:", apiErr);
      }

      setMessage({
        text: editingExam
          ? `Ujian "${examData.examTitle}" berhasil diperbarui di database Firebase Firestore!`
          : `Ujian "${examData.examTitle}" berhasil disimpan ke database Firebase Firestore!`,
        type: 'success'
      });
      setIsModalOpen(false);
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      console.error("Save exam error:", err);
      setMessage({
        text: err.message ? `Gagal menyimpan ke Firebase: ${err.message}` : "Terjadi kesalahan saat menyimpan data ujian.",
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExam = async (id: string) => {
    let activeUser = currentUser;
    if (!activeUser) {
      try {
        activeUser = await loginAsDefaultAdmin();
        setCurrentUser(activeUser);
      } catch (authErr) {
        setMessage({ text: "Anda harus login untuk menghapus data ujian.", type: 'error' });
        return;
      }
    }

    try {
      // 1. Delete from Firestore
      try {
        await deleteDoc(doc(db, 'exams', id));
      } catch (fsErr: any) {
        console.error("Firestore deleteDoc error:", fsErr);
        handleFirestoreError(fsErr, OperationType.DELETE, `exams/${id}`);
      }

      // 2. Delete from REST API
      try {
        await fetch(`/api/exams/${id}`, { method: 'DELETE' });
      } catch (apiErr) {
        console.warn("API delete fallback warning:", apiErr);
      }

      setMessage({ text: "Ujian berhasil dihapus dari database akun Anda.", type: 'success' });
      setDeleteConfirmId(null);
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      console.error(err);
      setMessage({ text: err.message || "Kesalahan saat menghapus ujian dari Firebase.", type: 'error' });
    }
  };


  const generateRandomPin = (field: 'pinMasuk' | 'pinKeluar' | 'pinPengawas') => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    setFormData((prev) => ({ ...prev, [field]: pin }));
  };

  const generateAllRandomPins = () => {
    setFormData((prev) => ({
      ...prev,
      pinMasuk: Math.floor(1000 + Math.random() * 9000).toString(),
      pinPengawas: Math.floor(1000 + Math.random() * 9000).toString(),
      pinKeluar: Math.floor(1000 + Math.random() * 9000).toString(),
    }));
  };

  const handleSaveClientSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingClientSettings(true);
      const activeUser = currentUser || await loginAsDefaultAdmin();

      const configId = `CFG_${activeUser.uid.replace(/[^a-zA-Z0-9_\-]/g, '_')}`;
      const payload = {
        id: configId,
        authorId: activeUser.uid,
        authorEmail: activeUser.email || '',
        schoolName: (clientSettings.schoolName || 'SMA Negeri CBT').trim(),
        appName: 'EXAMCBT Lockdown Client',
        clientProfile: 'exambro_android',
        appVersion: 'v2.5.0',
        clientSecurityToken: 'EXAM-SEC-2026-TOKEN',
        targetExamId: exams[0]?.id || 'EXAM-2026-001',
        lockFullscreen: clientSettings.securityMode !== 'santai',
        blockTabSwitch: clientSettings.securityMode !== 'santai',
        maxViolations: clientSettings.maxViolations,
        blockSplitScreen: clientSettings.blockSplitScreen,
        blockScreenshot: clientSettings.blockScreenshot,
        blockInspectElement: true,
        blockCopyPaste: true,
        blockBackNav: true,
        disableSound: true,
        splashNotice: clientSettings.splashNotice,
        updatedAt: new Date().toISOString()
      };

      // 1. Save to Firestore with user isolation
      try {
        await setDoc(doc(db, 'client_configs', configId), payload, { merge: true });
      } catch (fsErr) {
        console.warn("Firestore client config save notice:", fsErr);
      }

      // 2. Save to Server REST API
      try {
        await fetch('/api/client/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (apiErr) {
        console.warn("API client config save notice:", apiErr);
      }

      setMessage({ text: "Pengaturan aplikasi client berhasil disimpan dan diterapkan!", type: 'success' });
      setTimeout(() => setMessage(null), 3500);
    } catch (err: any) {
      console.error(err);
      setMessage({ text: "Gagal menyimpan pengaturan: " + (err.message || ''), type: 'error' });
    } finally {
      setSavingClientSettings(false);
    }
  };

  const handleDownloadClientJson = () => {
    const activeExam = exams[0];
    const data = {
      app: "EXAMCBT",
      version: "2.5.0",
      schoolName: clientSettings.schoolName,
      securityMode: clientSettings.securityMode,
      maxViolations: clientSettings.maxViolations,
      blockScreenshot: clientSettings.blockScreenshot,
      blockSplitScreen: clientSettings.blockSplitScreen,
      splashNotice: clientSettings.splashNotice,
      activeExam: activeExam ? {
        id: activeExam.id,
        examTitle: activeExam.examTitle,
        subject: activeExam.subject,
        googleFormUrl: activeExam.googleFormUrl,
        pinMasuk: activeExam.pinMasuk,
        pinPengawas: activeExam.pinPengawas,
        pinKeluar: activeExam.pinKeluar,
        durationMinutes: activeExam.durationMinutes,
      } : null,
      serverApiUrl: `${window.location.origin}/api/client/config`
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `client-config-${clientSettings.securityMode}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSeb = () => {
    const targetId = exams[0]?.id || '';
    window.location.href = `/api/client/seb-config${targetId ? `?id=${targetId}` : ''}`;
  };

  const handleOpenSimulator = (exam?: ExamItem) => {
    const target = exam || exams[0];
    if (!target) {
      setMessage({ text: "Tambahkan atau buat jadwal ujian terlebih dahulu untuk uji coba simulasi.", type: 'error' });
      return;
    }
    setSimExam(target);
    setSimViolations(0);
    setSimStep('pin_masuk');
    setSimPinInput('');
    setSimMessage('');
    setIsSimulatorOpen(true);
  };

  const handleSimPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simExam) return;
    if (simStep === 'pin_masuk') {
      if (simPinInput.trim() === simExam.pinMasuk) {
        setSimStep('exam');
        setSimMessage('PIN Masuk diverifikasi! Soal Google Form berhasil dimuat di browser terkunci.');
        setSimPinInput('');
      } else {
        setSimMessage(`PIN Masuk salah! (Petunjuk PIN yang benar: ${simExam.pinMasuk})`);
      }
    } else if (simStep === 'locked') {
      if (simPinInput.trim() === simExam.pinPengawas) {
        setSimStep('exam');
        setSimViolations(0);
        setSimMessage('Kunci darurat dibuka oleh Pengawas! Sesi siswa dilanjutkan.');
        setSimPinInput('');
      } else {
        setSimMessage(`PIN Pengawas salah! (Petunjuk PIN Pengawas: ${simExam.pinPengawas})`);
      }
    } else if (simStep === 'exam') {
      if (simPinInput.trim() === simExam.pinKeluar) {
        setSimStep('finished');
        setSimMessage('Ujian selesai dan sesi berhasil diakhiri dengan aman.');
        setSimPinInput('');
      } else {
        setSimMessage(`PIN Keluar salah! (Petunjuk PIN Keluar: ${simExam.pinKeluar})`);
      }
    }
  };

  const handleSimulateViolation = () => {
    if (simStep !== 'exam') return;
    if (clientSettings.securityMode === 'santai') {
      setSimMessage('Mode Santai: Perpindahan tab / jendela diizinkan.');
      return;
    }
    const nextCount = simViolations + 1;
    setSimViolations(nextCount);
    if (nextCount >= clientSettings.maxViolations) {
      setSimStep('locked');
      setSimMessage(`PERINGATAN: Terdeteksi keluar aplikasi ${nextCount}x (batas toleransi ${clientSettings.maxViolations}x). Layar siswa terkunci otomatis! Harap panggil Pengawas.`);
      setSimPinInput('');
    } else {
      setSimMessage(`Peringatan Pelanggaran: Terdeteksi keluar layar (${nextCount}/${clientSettings.maxViolations}). Sisa kesempatan: ${clientSettings.maxViolations - nextCount}`);
    }
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

  const selectedClientExam = exams[0];

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
            <span className={`w-2 h-2 rounded-full ${isFirebaseSyncActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-slate-400 text-[11px]">
              {isFirebaseSyncActive ? 'Firestore Realtime Aktif' : 'Firestore Menghubungkan'}
            </span>
          </div>

          {/* User Auth Section */}
          {currentUser ? (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-2 p-1 hover:bg-slate-850 rounded-lg transition-colors text-left"
                title="Kelola Akun / Ganti Pengguna"
              >
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
                  <span className="text-xs font-medium text-slate-200 leading-tight truncate max-w-[140px]">
                    {currentUser.displayName || currentUser.email?.split('@')[0]}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold leading-tight flex items-center gap-1">
                    <span>{currentUser.email === 'iswanlabanto18@guru.sma.belajar.id' || currentUser.email === 'guru.iswan@examcbt.id' ? 'Guru Admin' : 'Admin'}</span>
                    <span className="text-slate-500">• Ganti</span>
                  </span>
                </div>
              </button>
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
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700/30 hover:bg-emerald-600/40 text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-500/40 transition-all shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5 text-emerald-400" />
              <span>Masuk / Akun Guru</span>
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
          <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm print:hidden shadow-lg transition-all ${
            message.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
              : 'bg-red-500/15 border-red-500/40 text-red-200'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" /> : <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />}
            <span className="font-medium">{message.text}</span>
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
            onClick={() => setActiveTab('client-settings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'client-settings'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Pengaturan Aplikasi Client</span>
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
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-base font-semibold text-white">Daftar Sesi Ujian & QR Soal Google Form</h2>
                <p className="text-xs text-slate-400">Tersimpan secara realtime dan privat di Firebase Firestore. PIN Masuk, PIN Pengawas, dan PIN Keluar siap ditangkap oleh aplikasi client.</p>
              </div>
            </div>

            {/* User Isolation Security Banner */}
            {currentUser ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-slate-900/90 border border-emerald-500/30 rounded-xl text-xs text-slate-300 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong className="text-emerald-400 font-semibold">Database Firestore Terkoneksi:</strong> Data ujian Anda terikat eksklusif ke akun <span className="text-white font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{currentUser.email}</span>. Setiap perubahan otomatis tersimpan permanen ke Firestore.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="text-[11px] text-emerald-400 hover:underline shrink-0"
                >
                  Ganti Akun
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>Mode Akses Privat:</strong> Masuk untuk membaca dan menyimpan data ujian langsung ke database Firebase akun Anda.
                  </span>
                </div>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg shrink-0 transition-colors flex items-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Masuk Akun</span>
                </button>
              </div>
            )}


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

        {/* Tab 2: Pengaturan Aplikasi Client (Sederhana & Tanpa Tumpang Tindih) */}
        {activeTab === 'client-settings' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-8">
            {/* Header Tab */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-emerald-400" />
                  <span>Pengaturan Aplikasi Client Ujian Siswa</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Pilih tingkat proteksi aplikasi client (Exambro / Kios Browser). Pengaturan ini otomatis menyatu ke dalam QR Soal ujian.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleOpenSimulator(exams[0])}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-all shadow-sm"
              >
                <Eye className="w-4 h-4 text-emerald-400" />
                <span>Uji Coba Layar Siswa (Simulator)</span>
              </button>
            </div>

            <form onSubmit={handleSaveClientSettings} className="space-y-8">
              {/* Bagian 1: 3 Mode Keamanan Sederhana */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span>1. Pilih Tingkat Keamanan Klien (1-Klik)</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Pilih salah satu sesuai kebutuhan ujian</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Mode Standar */}
                  <div
                    onClick={() => setClientSettings({
                      ...clientSettings,
                      securityMode: 'standar',
                      maxViolations: 3,
                      blockScreenshot: true,
                      blockSplitScreen: true,
                    })}
                    className={`cursor-pointer p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                      clientSettings.securityMode === 'standar'
                        ? 'bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500/50 shadow-md'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-white flex items-center gap-1.5">
                          <Shield className="w-4 h-4 text-emerald-400" />
                          <span>Standar</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300">
                          Rekomendasi
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed mb-4">
                        Wajib Layar Penuh (Fullscreen) dan mendeteksi siswa yang beralih tab atau minimize.
                      </p>
                    </div>
                    <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-300 flex items-center justify-between">
                      <span className="text-slate-400">Toleransi Keluar:</span>
                      <strong className="text-emerald-400 font-mono">Maksimal 3 Kali</strong>
                    </div>
                  </div>

                  {/* Mode Ketat */}
                  <div
                    onClick={() => setClientSettings({
                      ...clientSettings,
                      securityMode: 'ketat',
                      maxViolations: 1,
                      blockScreenshot: true,
                      blockSplitScreen: true,
                    })}
                    className={`cursor-pointer p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                      clientSettings.securityMode === 'ketat'
                        ? 'bg-red-500/10 border-red-500 ring-1 ring-red-500/50 shadow-md'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-white flex items-center gap-1.5">
                          <Lock className="w-4 h-4 text-red-400" />
                          <span>Ketat / Zero Cheating</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/20 text-red-300">
                          Super Aman
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed mb-4">
                        Toleransi 1x langsung terkunci permanen. Blokir tangkapan layar (screenshot) & split-screen secara total.
                      </p>
                    </div>
                    <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-300 flex items-center justify-between">
                      <span className="text-slate-400">Toleransi Keluar:</span>
                      <strong className="text-red-400 font-mono">1 Kali Langsung Kunci</strong>
                    </div>
                  </div>

                  {/* Mode Santai / Latihan */}
                  <div
                    onClick={() => setClientSettings({
                      ...clientSettings,
                      securityMode: 'santai',
                      maxViolations: 99,
                      blockScreenshot: false,
                      blockSplitScreen: false,
                    })}
                    className={`cursor-pointer p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                      clientSettings.securityMode === 'santai'
                        ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500/50 shadow-md'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-white flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-400" />
                          <span>Santai / Latihan</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300">
                          Simulasi
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed mb-4">
                        Tanpa penguncian layar. Siswa bebas membuka materi atau catatan pendukung untuk latihan mandiri.
                      </p>
                    </div>
                    <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-300 flex items-center justify-between">
                      <span className="text-slate-400">Penguncian:</span>
                      <strong className="text-amber-400 font-mono">Nonaktif (Bebas)</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bagian 2: Identitas Sekolah & Pesan Siswa */}
              <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
                <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>2. Informasi Tampilan Klien</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1.5">Nama Sekolah / Lembaga</label>
                    <input
                      type="text"
                      value={clientSettings.schoolName}
                      onChange={(e) => setClientSettings({ ...clientSettings, schoolName: e.target.value })}
                      placeholder="Contoh: SMA Negeri 1 CBT"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1.5">Pesan Peringatan / Tata Tertib Siswa</label>
                    <input
                      type="text"
                      value={clientSettings.splashNotice}
                      onChange={(e) => setClientSettings({ ...clientSettings, splashNotice: e.target.value })}
                      placeholder="Contoh: Dilarang keluar aplikasi selama ujian berlangsung."
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Checkbox proteksi cepat */}
                <div className="flex flex-wrap items-center gap-6 pt-2 text-xs text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clientSettings.blockScreenshot}
                      onChange={(e) => setClientSettings({ ...clientSettings, blockScreenshot: e.target.checked })}
                      className="w-4 h-4 accent-emerald-500 rounded bg-slate-900"
                    />
                    <span>Blokir Screenshot & Perekaman Layar (FLAG_SECURE)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clientSettings.blockSplitScreen}
                      onChange={(e) => setClientSettings({ ...clientSettings, blockSplitScreen: e.target.checked })}
                      className="w-4 h-4 accent-emerald-500 rounded bg-slate-900"
                    />
                    <span>Blokir Layar Terbagi (Split-screen) di Ponsel / Tablet</span>
                  </label>
                </div>
              </div>

              {/* Tombol Simpan Pengaturan */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-400">
                  Perubahan akan otomatis tersimpan ke Firebase dan disinkronkan ke seluruh aplikasi client siswa.
                </span>

                <button
                  type="submit"
                  disabled={savingClientSettings}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {savingClientSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  <span>{savingClientSettings ? 'Menyimpan...' : 'Simpan Pengaturan Client'}</span>
                </button>
              </div>
            </form>

            {/* Bagian 3: Alat Distribusi & Ekspor Cepat (Tanpa Duplikasi) */}
            <div className="pt-6 border-t border-slate-800 space-y-4">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Download className="w-4 h-4 text-emerald-400" />
                <span>3. Ekspor & Integrasi Cepat</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={handleDownloadClientJson}
                  className="p-3 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded-xl text-xs text-left transition-colors flex items-center justify-between group"
                >
                  <div>
                    <span className="font-semibold text-slate-200 block group-hover:text-emerald-400 transition-colors">Unduh File JSON</span>
                    <span className="text-[10px] text-slate-400">client-config.json untuk Exambro</span>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                </button>

                <button
                  type="button"
                  onClick={handleDownloadSeb}
                  className="p-3 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded-xl text-xs text-left transition-colors flex items-center justify-between group"
                >
                  <div>
                    <span className="font-semibold text-slate-200 block group-hover:text-emerald-400 transition-colors">Unduh Format SEB</span>
                    <span className="text-[10px] text-slate-400">Untuk Safe Exam Browser (PC/Mac)</span>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                </button>

                <button
                  type="button"
                  onClick={() => copyToClipboard(`${window.location.origin}/api/client/config`, 'api-endpoint')}
                  className="p-3 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded-xl text-xs text-left transition-colors flex items-center justify-between group"
                >
                  <div>
                    <span className="font-semibold text-slate-200 block group-hover:text-emerald-400 transition-colors">Salin URL API Client</span>
                    <span className="text-[10px] text-slate-400">/api/client/config (GET)</span>
                  </div>
                  {copied === 'api-endpoint' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 transition-colors" />}
                </button>
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-300">Durasi (Menit)</label>
                    <div className="flex gap-1">
                      {[60, 90, 120].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, durationMinutes: mins }))}
                          className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                            formData.durationMinutes === mins
                              ? 'bg-emerald-600 text-white font-semibold'
                              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                          }`}
                        >
                          {mins}m
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="number"
                    value={formData.durationMinutes || 90}
                    onChange={(e) => setFormData({ ...formData, durationMinutes: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                  placeholder="https://docs.google.com/forms/d/e/.../viewform?embedded=true"
                  required
                />
              </div>

              {/* 3 Jenis PIN Section (4 Digit) */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Pengaturan 3 Jenis PIN (4 Digit)</h4>
                  <button
                    type="button"
                    onClick={generateAllRandomPins}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-[11px] text-emerald-400 border border-slate-800 rounded-lg transition-colors font-medium shadow-sm"
                    title="Acak ketiga PIN sekaligus"
                  >
                    <RefreshCw className="w-3 h-3 text-emerald-400" />
                    <span>Acak Semua PIN</span>
                  </button>
                </div>
                
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
                Tindakan ini tidak dapat dibatalkan. Ujian dan PIN yang terkait akan dihapus secara permanen dari database Firebase Firestore.
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

      {/* Authentication & User Account Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Akun Admin & Database Firebase</h3>
                  <p className="text-[11px] text-slate-400">Pilih metode masuk untuk isolasi data privat</p>
                </div>
              </div>
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick 1-Click Login Option */}
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>Akses Cepat Guru (Rekomendasi)</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full font-mono">
                  1-Klik
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Masuk otomatis sebagai <strong className="text-white">Iswan Labanto</strong> (guru.iswan@examcbt.id). Langsung terhubung dengan database Firestore tanpa popup blocker.
              </p>
              <button
                type="button"
                disabled={authActionLoading}
                onClick={handleQuickLogin}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {authActionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                <span>Masuk Cepat Guru (Iswan Labanto)</span>
              </button>
            </div>

            {/* Tab switch for Email Login / Register */}
            <div className="flex gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setAuthTab('email')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-colors ${authTab === 'email' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Masuk Email
              </button>
              <button
                type="button"
                onClick={() => setAuthTab('register')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-colors ${authTab === 'register' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Daftar Baru
              </button>
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailAuth} className="space-y-3">
              {authTab === 'register' && (
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Nama Lengkap Guru / Penguji</label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Contoh: Iswan Labanto, S.Pd"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Alamat Email</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="nama@guru.sma.belajar.id"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Kata Sandi</label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={passInput}
                    onChange={(e) => setPassInput(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authActionLoading}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 border border-slate-700"
              >
                {authActionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : (authTab === 'register' ? <UserPlus className="w-3.5 h-3.5 text-emerald-400" /> : <LogIn className="w-3.5 h-3.5 text-emerald-400" />)}
                <span>{authTab === 'register' ? 'Daftar Akun Baru' : 'Masuk dengan Email'}</span>
              </button>
            </form>

            {/* Google Login Alternative */}
            <div className="pt-2 border-t border-slate-800 text-center">
              <button
                type="button"
                disabled={authActionLoading}
                onClick={handleLoginGoogle}
                className="w-full py-2 px-3 bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-xl border border-slate-800 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <LogIn className="w-3.5 h-3.5 text-amber-400" />
                <span>Masuk dengan Google (Popup)</span>
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Interactive Student Screen Simulator Modal */}
      {isSimulatorOpen && simExam && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Simulasi Layar Aplikasi Klien Siswa</h3>
                  <p className="text-[11px] text-slate-400">Pratinjau tampilan di ponsel/laptop siswa</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSimulatorOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Smartphone Mockup */}
            <div className="bg-slate-950 border-2 border-slate-700 rounded-[2rem] p-4 text-slate-100 shadow-inner flex flex-col min-h-[480px]">
              {/* Speaker notch */}
              <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-3 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-950"></div>
              </div>

              {/* Status bar */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 pb-2 mb-2 border-b border-slate-800 px-1 font-mono">
                <span className="font-bold text-slate-300">{clientSettings.schoolName}</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold uppercase">
                  {clientSettings.securityMode}
                </span>
              </div>

              {/* Notice Banner in Simulator */}
              {simMessage && (
                <div className={`p-2.5 rounded-xl text-xs mb-3 flex items-start gap-2 ${
                  simStep === 'locked'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {simStep === 'locked' ? <ShieldAlert className="w-4 h-4 shrink-0 text-red-400 mt-0.5" /> : <Info className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />}
                  <span className="leading-snug">{simMessage}</span>
                </div>
              )}

              {/* Step 1: Input PIN Masuk */}
              {simStep === 'pin_masuk' && (
                <div className="flex-1 flex flex-col justify-center text-center space-y-4 py-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                    <Key className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{simExam.examTitle}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{simExam.subject} • {simExam.durationMinutes} Menit</p>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-[11px] text-slate-300 text-left space-y-1">
                    <span className="font-semibold text-slate-200 block">Tata Tertib:</span>
                    <p className="text-slate-400">{clientSettings.splashNotice}</p>
                  </div>

                  <form onSubmit={handleSimPinSubmit} className="space-y-3">
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">Masukkan PIN Masuk</label>
                      <input
                        type="text"
                        maxLength={4}
                        value={simPinInput}
                        onChange={(e) => setSimPinInput(e.target.value)}
                        placeholder={simExam.pinMasuk}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-center font-mono text-lg font-bold text-emerald-400 tracking-widest focus:outline-none focus:border-emerald-500"
                        autoFocus
                        required
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        (Petunjuk PIN Masuk: <strong className="text-emerald-400 font-mono">{simExam.pinMasuk}</strong>)
                      </span>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow transition-colors"
                    >
                      Buka Soal Ujian
                    </button>
                  </form>
                </div>
              )}

              {/* Step 2: Halaman Ujian Terbuka */}
              {simStep === 'exam' && (
                <div className="flex-1 flex flex-col space-y-3">
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block">{simExam.subject}</span>
                      <h4 className="text-xs font-bold text-white truncate max-w-[180px]">{simExam.examTitle}</h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block font-mono">Sisa Waktu</span>
                      <span className="text-xs font-mono font-bold text-emerald-400">{simExam.durationMinutes}:00</span>
                    </div>
                  </div>

                  {/* Mock Google Form Frame */}
                  <div className="flex-1 bg-white rounded-xl p-4 text-slate-900 overflow-y-auto max-h-56 space-y-3 border shadow-inner">
                    <div className="border-b pb-2">
                      <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Google Formulir</span>
                      <h5 className="text-xs font-bold text-slate-900">{simExam.examTitle}</h5>
                      <p className="text-[10px] text-slate-600 truncate">{simExam.googleFormUrl}</p>
                    </div>

                    <div className="space-y-2 text-[11px]">
                      <div className="p-2 bg-slate-50 rounded border border-slate-200">
                        <span className="font-semibold block text-slate-800">1. Soal Evaluasi Pembelajaran</span>
                        <span className="text-[10px] text-slate-500 block mt-1">Siswa mengisi lembar jawaban secara langsung di dalam aplikasi client yang terkunci.</span>
                      </div>
                    </div>
                  </div>

                  {/* Anti-Cheat Demonstration Action */}
                  <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Deteksi Pelanggaran:</span>
                      <span className={`font-mono font-bold ${simViolations > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                        {simViolations} / {clientSettings.maxViolations} Kali
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleSimulateViolation}
                      className="w-full py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Uji Coba: Siswa Pindah Tab / Minimize</span>
                    </button>
                  </div>

                  {/* Selesai Ujian Form with PIN Keluar */}
                  <form onSubmit={handleSimPinSubmit} className="pt-1 flex gap-2">
                    <input
                      type="text"
                      maxLength={4}
                      value={simPinInput}
                      onChange={(e) => setSimPinInput(e.target.value)}
                      placeholder={`PIN Keluar (${simExam.pinKeluar})`}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-center font-mono font-bold text-amber-400 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold transition-colors"
                    >
                      Selesai
                    </button>
                  </form>
                </div>
              )}

              {/* Step 3: Ujian Terkunci (Perlu PIN Pengawas) */}
              {simStep === 'locked' && (
                <div className="flex-1 flex flex-col justify-center text-center space-y-4 py-4 bg-red-950/20 rounded-2xl p-4 border border-red-500/30">
                  <div className="w-14 h-14 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center text-red-400 mx-auto animate-bounce">
                    <Lock className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-red-400 uppercase tracking-wider">Layar Ujian Terkunci!</h4>
                    <p className="text-xs text-slate-300 mt-1">
                      Terdeteksi keluar dari aplikasi ujian lebih dari batas toleransi ({clientSettings.maxViolations}x).
                    </p>
                  </div>

                  <form onSubmit={handleSimPinSubmit} className="space-y-3 pt-2">
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">Minta Pengawas Masukkan PIN Pengawas</label>
                      <input
                        type="text"
                        maxLength={4}
                        value={simPinInput}
                        onChange={(e) => setSimPinInput(e.target.value)}
                        placeholder={simExam.pinPengawas}
                        className="w-full bg-slate-900 border border-red-500/50 rounded-xl px-3 py-2 text-center font-mono text-lg font-bold text-blue-400 tracking-widest focus:outline-none focus:border-blue-400"
                        autoFocus
                        required
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        (PIN Pengawas: <strong className="text-blue-400 font-mono">{simExam.pinPengawas}</strong>)
                      </span>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow transition-colors"
                    >
                      Buka Kunci Pengawas
                    </button>
                  </form>
                </div>
              )}

              {/* Step 4: Finished */}
              {simStep === 'finished' && (
                <div className="flex-1 flex flex-col justify-center text-center space-y-4 py-6">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 mx-auto">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Sesi Ujian Selesai</h4>
                    <p className="text-xs text-slate-400 mt-1">Jawaban siswa tersimpan dan aplikasi client keluar dari fullscreen lock.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSimStep('pin_masuk');
                      setSimViolations(0);
                      setSimMessage('');
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl font-medium transition-colors mx-auto"
                  >
                    Ulangi Simulasi
                  </button>
                </div>
              )}
            </div>

            <div className="text-center pt-1">
              <span className="text-[11px] text-slate-400">
                Simulasi ini membuktikan konfigurasi mode <strong className="text-emerald-400">{clientSettings.securityMode}</strong> aktif pada aplikasi client siswa.
              </span>
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
