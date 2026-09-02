'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Megaphone,
  Plus,
  Send,
  Loader2,
  Bell,
  AlertTriangle,
  BookOpen,
  Calendar,
  Users,
  Clock,
  ChevronLeft,
  Search,
  Circle,
  Image as ImageIcon,
  Video,
  Upload,
  Download,
  Trash2,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/lib/store';
import { withSchoolYear } from '@/lib/utils';
import {
  ANNOUNCEMENT_TYPES,
  ANNOUNCEMENT_TYPE_LABELS,
  ANNOUNCEMENT_TARGETS,
  ANNOUNCEMENT_TARGET_LABELS,
} from '@/lib/constants';
import type { Announcement, Message, User } from '@/lib/types';

function getTypeIcon(type: string) {
  switch (type) {
    case 'urgent': return <AlertTriangle className="w-4 h-4" />;
    case 'academic': return <BookOpen className="w-4 h-4" />;
    case 'event': return <Calendar className="w-4 h-4" />;
    default: return <Bell className="w-4 h-4" />;
  }
}

function getTypeColor(type: string): string {
  switch (type) {
    case 'urgent': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
    case 'academic': return 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800';
    case 'event': return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
    default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-muted dark:text-muted-foreground dark:border-border';
  }
}

export default function CommunicationModule() {
  const addToast = useAppStore((s) => s.addToast);
  const currentUser = useAppStore((s) => s.currentUser);
  const schoolYear = useAppStore((s) => s.schoolYear);
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const isSuperAdmin = currentUser?.role === 'super_admin';

  // ---- Announcements State ----
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [createAnnouncementOpen, setCreateAnnouncementOpen] = useState(false);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [annFormTitle, setAnnFormTitle] = useState('');
  const [annFormContent, setAnnFormContent] = useState('');
  const [annFormType, setAnnFormType] = useState<'general' | 'urgent' | 'academic' | 'event'>('general');
  const [annFormTarget, setAnnFormTarget] = useState<'all' | 'teachers' | 'students' | 'parents'>('all');
  const [annFormMedia, setAnnFormMedia] = useState<File | null>(null);
  const [annFormMediaPreview, setAnnFormMediaPreview] = useState<string>('');
  const [annFormMediaType, setAnnFormMediaType] = useState<'image' | 'video' | ''>('');
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // ---- Messages State ----
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [msgFormReceiverId, setMsgFormReceiverId] = useState('');
  const [msgFormContent, setMsgFormContent] = useState('');
  const [msgSearch, setMsgSearch] = useState('');

  // ---- Fetch Announcements ----
  const fetchAnnouncements = useCallback(async () => {
    setAnnouncementsLoading(true);
    try {
      const res = await fetch(withSchoolYear('/api/announcements', schoolYear));
      const data = await res.json();
      setAnnouncements(data.announcements || []);
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les annonces');
    } finally {
      setAnnouncementsLoading(false);
    }
  }, [addToast, schoolYear]);

  // ---- Fetch Messages ----
  const fetchMessages = useCallback(async () => {
    if (!currentUser?.id) return;
    setMessagesLoading(true);
    try {
      const res = await fetch(withSchoolYear(`/api/messages?userId=${currentUser.id}`, schoolYear));
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les messages');
    } finally {
      setMessagesLoading(false);
    }
  }, [currentUser?.id, addToast, schoolYear]);

  // ---- Fetch Users for messaging ----
  const fetchUsers = useCallback(async () => {
    // We'll get users from teachers and students
    try {
      const [teachersRes, studentsRes] = await Promise.all([
        fetch(withSchoolYear('/api/teachers', schoolYear)),
        fetch(withSchoolYear('/api/students', schoolYear)),
      ]);
      const teachersData = await teachersRes.json();
      const studentsData = await studentsRes.json();

      const teacherUsers: User[] = (teachersData.teachers || []).map((t: { userId: string; firstName: string; lastName: string; user?: { id: string; email: string } }) => ({
        id: t.userId || t.user?.id || '',
        name: `${t.firstName} ${t.lastName}`,
        email: t.user?.email || '',
        role: 'teacher' as const,
        password: '',
        avatar: null,
        phone: null,
        active: true,
        createdAt: '',
        updatedAt: '',
      }));

      const studentUsers: User[] = (studentsData.students || []).map((s: { userId: string; firstName: string; lastName: string; user?: { id: string; email: string } }) => ({
        id: s.userId || s.user?.id || '',
        name: `${s.firstName} ${s.lastName}`,
        email: s.user?.email || '',
        role: 'student' as const,
        password: '',
        avatar: null,
        phone: null,
        active: true,
        createdAt: '',
        updatedAt: '',
      }));

      setUsers([...teacherUsers, ...studentUsers]);
    } catch {
      // silently fail
    }
  }, [schoolYear]);

  useEffect(() => {
    fetchAnnouncements();
    fetchMessages();
    fetchUsers();
  }, [fetchAnnouncements, fetchMessages, fetchUsers]);

  // ---- Conversations (unique chat partners) ----
  const conversations = useMemo(() => {
    if (!currentUser?.id) return [];
    const partnerMap = new Map<string, { partnerId: string; partnerName: string; lastMessage: Message; unread: number }>();

    messages.forEach((msg) => {
      const isSender = msg.senderId === currentUser.id;
      const partnerId = isSender ? msg.receiverId : msg.senderId;
      const partnerName = isSender
        ? (msg.receiver?.name || 'Destinataire')
        : (msg.sender?.name || 'Expéditeur');

      const existing = partnerMap.get(partnerId);
      if (!existing || new Date(msg.createdAt) > new Date(existing.lastMessage.createdAt)) {
        partnerMap.set(partnerId, {
          partnerId,
          partnerName,
          lastMessage: msg,
          unread: 0,
        });
      }
      // Count unread
      if (!isSender && !msg.read) {
        const entry = partnerMap.get(partnerId)!;
        entry.unread += 1;
      }
    });

    return Array.from(partnerMap.values()).sort(
      (a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    );
  }, [messages, currentUser?.id]);

  // Messages for selected conversation
  const conversationMessages = useMemo(() => {
    if (!selectedConversation || !currentUser?.id) return [];
    return messages
      .filter(
        (m) =>
          (m.senderId === currentUser.id && m.receiverId === selectedConversation) ||
          (m.receiverId === currentUser.id && m.senderId === selectedConversation)
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages, selectedConversation, currentUser?.id]);

  // ---- Handlers ----
  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      addToast('error', 'Fichier invalide', 'Veuillez sélectionner une image ou une vidéo');
      e.target.value = '';
      return;
    }
    // Images: max 10 MB, Videos: max 50 MB
    const maxBytes = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    const maxLabel = isVideo ? '50 Mo' : '10 Mo';
    if (file.size > maxBytes) {
      addToast(
        'error',
        'Fichier trop volumineux',
        `La taille maximale pour une ${isVideo ? 'vidéo' : 'image'} est de ${maxLabel}`
      );
      e.target.value = '';
      return;
    }

    setAnnFormMedia(file);
    setAnnFormMediaType(isImage ? 'image' : 'video');
    setAnnFormMediaPreview(URL.createObjectURL(file));
  };

  const handleRemoveMedia = () => {
    if (annFormMediaPreview) URL.revokeObjectURL(annFormMediaPreview);
    setAnnFormMedia(null);
    setAnnFormMediaPreview('');
    setAnnFormMediaType('');
  };

  const handleCreateAnnouncement = async () => {
    if (!annFormTitle || !annFormContent) {
      addToast('warning', 'Champs requis', 'Veuillez remplir le titre et le contenu');
      return;
    }
    setSavingAnnouncement(true);

    let uploadedMediaUrl: string | null = null;

    try {
      // Upload the media file first (if any)
      if (annFormMedia) {
        setUploadingMedia(true);
        const formData = new FormData();
        formData.append('file', annFormMedia);
        const uploadRes = await fetch('/api/upload-media', {
          method: 'POST',
          body: formData,
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          throw new Error(err.error || "Échec de l'upload du média");
        }
        const uploadData = await uploadRes.json();
        uploadedMediaUrl = uploadData.url;
        setUploadingMedia(false);
      }

      const res = await fetch(withSchoolYear('/api/announcements', schoolYear), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: annFormTitle,
          content: annFormContent,
          type: annFormType,
          target: annFormTarget,
          authorId: currentUser?.id || '',
          mediaUrl: uploadedMediaUrl,
          mediaType: annFormMediaType || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur serveur');
      }
      addToast('success', 'Annonce publiée', 'L\'annonce a été publiée avec succès');
      setCreateAnnouncementOpen(false);
      setAnnFormTitle('');
      setAnnFormContent('');
      setAnnFormType('general');
      setAnnFormTarget('all');
      handleRemoveMedia();
      fetchAnnouncements();
    } catch (error) {
      setUploadingMedia(false);
      addToast('error', 'Erreur', error instanceof Error ? error.message : 'Impossible de publier l\'annonce');
    } finally {
      setSavingAnnouncement(false);
    }
  };

  // ---- Delete announcement ----
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState<string | null>(null);

  const handleDeleteAnnouncement = async (id: string, title: string) => {
    if (!confirm(`Supprimer l'annonce "${title}" ? Cette action est irréversible.`)) return;
    setDeletingAnnouncementId(id);
    try {
      const res = await fetch(`/api/announcements?id=${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': currentUser?.id || '',
          'x-institution-id': currentUser?.institutionId || '',
          'x-user-role': currentUser?.role || '',
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Échec de la suppression');
      addToast('success', 'Annonce supprimée', `"${title}" a été supprimée.`);
      await fetchAnnouncements();
    } catch (err) {
      addToast('error', 'Erreur', err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setDeletingAnnouncementId(null);
    }
  };

  const handleSendMessage = async () => {
    if (!msgFormReceiverId || !msgFormContent) {
      addToast('warning', 'Champs requis', 'Veuillez sélectionner un destinataire et écrire un message');
      return;
    }
    setSendingMsg(true);
    try {
      const res = await fetch(withSchoolYear('/api/messages', schoolYear), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser?.id,
          receiverId: msgFormReceiverId,
          content: msgFormContent,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur serveur');
      }
      addToast('success', 'Message envoyé', 'Votre message a été envoyé');
      setMsgFormContent('');
      setMsgFormReceiverId('');
      setComposeOpen(false);
      setSelectedConversation(msgFormReceiverId);
      fetchMessages();
    } catch (error) {
      addToast('error', 'Erreur', error instanceof Error ? error.message : 'Impossible d\'envoyer le message');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleQuickReply = async () => {
    if (!selectedConversation || !msgFormContent.trim()) return;
    setSendingMsg(true);
    try {
      const res = await fetch(withSchoolYear('/api/messages', schoolYear), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser?.id,
          receiverId: selectedConversation,
          content: msgFormContent,
        }),
      });
      if (!res.ok) throw new Error('Erreur');
      setMsgFormContent('');
      fetchMessages();
    } catch {
      addToast('error', 'Erreur', 'Impossible d\'envoyer le message');
    } finally {
      setSendingMsg(false);
    }
  };

  const filteredConversations = conversations.filter((c) =>
    !msgSearch || c.partnerName.toLowerCase().includes(msgSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Communication</h2>
          <p className="text-sm text-muted-foreground mt-1">Annonces et messagerie interne</p>
        </div>
      </div>

      <Tabs defaultValue="announcements" className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="announcements" className="flex-1 sm:flex-none gap-2">
            <Megaphone className="w-4 h-4" />
            Annonces
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex-1 sm:flex-none gap-2">
            <MessageSquare className="w-4 h-4" />
            Messages
            {conversations.some((c) => c.unread > 0) && (
              <Circle className="w-2 h-2 fill-red-500 text-red-500" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* ===== ANNONCES TAB ===== */}
        <TabsContent value="announcements" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setCreateAnnouncementOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle annonce
            </Button>
          </div>

          {announcementsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Megaphone className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">Aucune annonce</p>
                <p className="text-sm text-muted-foreground mt-1">Créez votre première annonce</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {announcements.map((announcement) => {
                  const isUrgent = announcement.type === 'urgent';
                  return (
                    <motion.div
                      key={announcement.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <Card className={`overflow-hidden ${isUrgent ? 'border-red-200 dark:border-red-800 border-l-4 border-l-red-500' : ''}`}>
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-foreground">{announcement.title}</h3>
                                <Badge className={getTypeColor(announcement.type)}>
                                  {getTypeIcon(announcement.type)}
                                  <span className="ml-1">{ANNOUNCEMENT_TYPE_LABELS[announcement.type] || announcement.type}</span>
                                </Badge>
                                <Badge variant="outline">
                                  <Users className="w-3 h-3 mr-1" />
                                  {ANNOUNCEMENT_TARGET_LABELS[announcement.target] || announcement.target}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                                {announcement.content}
                              </p>
                              {announcement.mediaUrl && announcement.mediaType === 'image' && (
                                <div className="mt-3 rounded-lg overflow-hidden border bg-muted/30 relative group">
                                  <img
                                    src={announcement.mediaUrl}
                                    alt={announcement.title}
                                    className="w-full max-h-80 object-cover"
                                  />
                                  <a
                                    href={announcement.mediaUrl}
                                    download
                                    className="absolute top-2 right-2 p-2 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                                    title="Télécharger l'image"
                                  >
                                    <Download className="w-4 h-4" />
                                  </a>
                                </div>
                              )}
                              {announcement.mediaUrl && announcement.mediaType === 'video' && (
                                <div className="mt-3 rounded-lg overflow-hidden border bg-black relative group">
                                  <video
                                    src={announcement.mediaUrl}
                                    controls
                                    className="w-full max-h-80 object-contain"
                                  />
                                  <a
                                    href={announcement.mediaUrl}
                                    download
                                    className="absolute top-2 right-2 p-2 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 z-10"
                                    title="Télécharger la vidéo"
                                  >
                                    <Download className="w-4 h-4" />
                                  </a>
                                </div>
                              )}
                              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(announcement.createdAt).toLocaleDateString('fr-FR', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                                {announcement.author && (
                                  <span>Par {announcement.author.name}</span>
                                )}
                                {announcement.mediaUrl && (
                                  <span className="flex items-center gap-1 text-muted-foreground/70">
                                    {announcement.mediaType === 'video' ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                                    {announcement.mediaType === 'video' ? 'Vidéo' : 'Image'}
                                  </span>
                                )}
                                {/* Delete button — visible only for admin/super_admin */}
                                {(isAdmin || isSuperAdmin) && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAnnouncement(announcement.id, announcement.title)}
                                    disabled={deletingAnnouncementId === announcement.id}
                                    className="ml-auto p-1.5 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50 shrink-0"
                                    title="Supprimer cette annonce"
                                  >
                                    {deletingAnnouncementId === announcement.id
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      : <Trash2 className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        {/* ===== MESSAGES TAB ===== */}
        <TabsContent value="messages" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setComposeOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouveau message
            </Button>
          </div>

          {messagesLoading ? (
            <Card>
              <CardContent className="p-6 space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[500px]">
              {/* Conversations List */}
              <Card className={`md:col-span-1 ${selectedConversation ? 'hidden md:block' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">Conversations</CardTitle>
                  </div>
                  <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher..."
                      value={msgSearch}
                      onChange={(e) => setMsgSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[380px]">
                    {filteredConversations.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground text-sm">
                        Aucune conversation
                      </div>
                    ) : (
                      filteredConversations.map((conv) => (
                        <button
                          key={conv.partnerId}
                          onClick={() => setSelectedConversation(conv.partnerId)}
                          className={`w-full text-left p-3 hover:bg-muted/50 transition-colors border-b ${
                            selectedConversation === conv.partnerId ? 'bg-emerald-50 dark:bg-emerald-950/30 border-l-2 border-l-emerald-500' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {conv.partnerName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{conv.partnerName}</p>
                                <p className="text-xs text-muted-foreground truncate">{conv.lastMessage.content}</p>
                              </div>
                            </div>
                            {conv.unread > 0 && (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex-shrink-0">
                                {conv.unread}
                              </span>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Message Thread */}
              <Card className={`md:col-span-2 ${!selectedConversation ? 'hidden md:flex' : 'flex'} flex-col`}>
                {selectedConversation ? (
                  <>
                    <CardHeader className="pb-3 border-b">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="md:hidden"
                          onClick={() => setSelectedConversation(null)}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center justify-center text-sm font-bold">
                          {conversations.find((c) => c.partnerId === selectedConversation)?.partnerName.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <CardTitle className="text-sm font-semibold">
                            {conversations.find((c) => c.partnerId === selectedConversation)?.partnerName || 'Conversation'}
                          </CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <ScrollArea className="flex-1 p-4 h-[340px]">
                      <div className="space-y-3">
                        {conversationMessages.map((msg) => {
                          const isOwn = msg.senderId === currentUser?.id;
                          return (
                            <motion.div
                              key={msg.id}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                                isOwn
                                  ? 'bg-emerald-600 text-white rounded-br-md'
                                  : 'bg-muted text-foreground rounded-bl-md'
                              }`}>
                                <p className="text-sm">{msg.content}</p>
                                <p className={`text-[10px] mt-1 ${isOwn ? 'text-emerald-100' : 'text-muted-foreground'}`}>
                                  {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                    <div className="p-3 border-t">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Écrire un message..."
                          value={msgFormContent}
                          onChange={(e) => setMsgFormContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleQuickReply();
                            }
                          }}
                        />
                        <Button
                          onClick={handleQuickReply}
                          disabled={sendingMsg || !msgFormContent.trim()}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <MessageSquare className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="text-muted-foreground">Sélectionnez une conversation</p>
                      <p className="text-sm text-muted-foreground mt-1">Ou démarrez une nouvelle discussion</p>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Announcement Dialog */}
      <Dialog open={createAnnouncementOpen} onOpenChange={setCreateAnnouncementOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nouvelle annonce</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Titre *</Label>
              <Input
                value={annFormTitle}
                onChange={(e) => setAnnFormTitle(e.target.value)}
                placeholder="Titre de l'annonce"
              />
            </div>
            <div className="grid gap-2">
              <Label>Contenu *</Label>
              <Textarea
                value={annFormContent}
                onChange={(e) => setAnnFormContent(e.target.value)}
                placeholder="Contenu de l'annonce..."
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={annFormType} onValueChange={(v) => setAnnFormType(v as typeof annFormType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANNOUNCEMENT_TYPES.map((at) => (
                      <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Cible</Label>
                <Select value={annFormTarget} onValueChange={(v) => setAnnFormTarget(v as typeof annFormTarget)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANNOUNCEMENT_TARGETS.map((at) => (
                      <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Image / Vidéo (optionnel)</Label>
              {!annFormMedia ? (
                <label
                  htmlFor="ann-media-upload"
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-muted-foreground/30 rounded-lg py-6 px-4 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Upload className="w-5 h-5" />
                    <span className="text-sm font-medium">Cliquez pour téléverser</span>
                  </div>
                  <p className="text-xs text-muted-foreground/70 text-center">
                    Image (JPEG, PNG, GIF, WebP — 10 Mo max) ou Vidéo (MP4, WebM, MOV — 50 Mo max)
                  </p>
                  <input
                    id="ann-media-upload"
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleMediaSelect}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="relative rounded-lg overflow-hidden border bg-muted/30">
                  {annFormMediaType === 'image' && (
                    <img src={annFormMediaPreview} alt="aperçu" className="w-full max-h-56 object-cover" />
                  )}
                  {annFormMediaType === 'video' && (
                    <video src={annFormMediaPreview} controls className="w-full max-h-56 bg-black object-contain" />
                  )}
                  <button
                    type="button"
                    onClick={handleRemoveMedia}
                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
                    aria-label="Retirer le média"
                    title="Retirer le média"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                    {annFormMediaType === 'video' ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                    <span className="max-w-[180px] truncate">{annFormMedia.name}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateAnnouncementOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateAnnouncement} disabled={savingAnnouncement} className="bg-emerald-600 hover:bg-emerald-700">
              {savingAnnouncement && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {uploadingMedia ? 'Téléversement...' : 'Publier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compose Message Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Nouveau message</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Destinataire *</Label>
              <Select value={msgFormReceiverId} onValueChange={setMsgFormReceiverId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un destinataire" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter((u) => u.id !== currentUser?.id)
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.role === 'teacher' ? 'Enseignant' : 'Élève'})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Message *</Label>
              <Textarea
                value={msgFormContent}
                onChange={(e) => setMsgFormContent(e.target.value)}
                placeholder="Écrire votre message..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>Annuler</Button>
            <Button onClick={handleSendMessage} disabled={sendingMsg} className="bg-emerald-600 hover:bg-emerald-700">
              {sendingMsg ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
