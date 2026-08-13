import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * GET /api/messages
 *
 * Query params:
 *   userId       (required) — the authenticated user's id
 *   withUserId   (optional) — when set, returns only the 1:1 conversation
 *                              between userId and withUserId (ordered ASC),
 *                              and marks the messages from withUserId as read.
 *   schoolYear   (optional) — filter by school year
 *
 * Without withUserId, returns ALL messages involving the user (sent OR
 * received), newest first. The frontend groups these into conversations.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const withUserId = searchParams.get('withUserId')
    const schoolYear = searchParams.get('schoolYear')

    if (!userId) {
      return NextResponse.json(
        { error: 'Paramètre userId requis' },
        { status: 400 }
      )
    }

    // ---- Conversation thread mode ----
    if (withUserId) {
      const where: Record<string, unknown> = {
        OR: [
          { senderId: userId, receiverId: withUserId },
          { senderId: withUserId, receiverId: userId },
        ],
      }
      if (schoolYear) where.schoolYear = schoolYear

      let messages: unknown[]
      try {
        messages = await db.message.findMany({
          where,
          include: {
            sender: {
              select: { id: true, name: true, email: true, role: true, avatar: true, userCode: true },
            },
            receiver: {
              select: { id: true, name: true, email: true, role: true, avatar: true, userCode: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        })
      } catch (findErr) {
        // Stale DB schema fallback (missing attachment columns). Return
        // an empty thread so the UI keeps working — the user will see a
        // prompt to run `bun run db:push` when they try to send.
        console.warn(
          '[messages] findMany failed (stale schema?):',
          findErr instanceof Error ? findErr.message : findErr
        )
        messages = []
      }

      // Mark messages FROM withUserId TO userId as read (best-effort, non-blocking)
      try {
        await db.message.updateMany({
          where: {
            senderId: withUserId,
            receiverId: userId,
            read: false,
          },
          data: { read: true },
        })
      } catch {
        /* ignore mark-read errors */
      }

      // Clear any unread "message" notifications for the current user that
      // were created by withUserId — they have now been read.
      try {
        await db.notification.deleteMany({
          where: {
            userId,
            category: 'message',
            linkParams: withUserId,
            read: false,
          },
        })
      } catch {
        /* ignore */
      }

      return NextResponse.json({ messages })
    }

    // ---- All messages mode (default) ----
    const where: Record<string, unknown> = {
      OR: [{ senderId: userId }, { receiverId: userId }],
    }
    if (schoolYear) where.schoolYear = schoolYear

    let messages: unknown[]
    try {
      messages = await db.message.findMany({
        where,
        include: {
          sender: {
            select: { id: true, name: true, email: true, role: true, avatar: true, userCode: true },
          },
          receiver: {
            select: { id: true, name: true, email: true, role: true, avatar: true, userCode: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    } catch (findErr) {
      // Stale DB schema fallback (missing attachment columns). Return
      // an empty list so the conversation list UI keeps working.
      console.warn(
        '[messages] findMany (all) failed (stale schema?):',
        findErr instanceof Error ? findErr.message : findErr
      )
      messages = []
    }

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Get messages error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des messages' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/messages
 * Body: { senderId, receiverId, content, schoolYear?, attachmentUrl?, attachmentType?, attachmentName?, attachmentSize? }
 *
 * Persists the message and returns it (with sender/receiver relations) so the
 * caller can immediately broadcast it via the chat socket service.
 *
 * A Notification row is also created for the receiver (category 'message',
 * link 'messages', linkParams = senderId) so the unread badge in the bell
 * dropdown reflects the new message. These notifications are cleared when
 * the receiver opens the conversation (see GET ?withUserId= above).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      senderId,
      receiverId,
      content,
      schoolYear,
      attachmentUrl,
      attachmentType,
      attachmentName,
      attachmentSize,
    } = body

    if (!senderId || !receiverId) {
      return NextResponse.json(
        { error: 'Expéditeur et destinataire requis' },
        { status: 400 }
      )
    }
    if (senderId === receiverId) {
      return NextResponse.json(
        { error: 'Impossible d’envoyer un message à soi-même' },
        { status: 400 }
      )
    }
    // Content may be empty when a message only carries an attachment.
    const text = String(content || '').slice(0, 4000)
    if (!text && !attachmentUrl) {
      return NextResponse.json(
        { error: 'Le message doit contenir du texte ou une pièce jointe' },
        { status: 400 }
      )
    }

    // Resolve sender name/institution/schoolYear for the notification + message
    const sender = await db.user.findUnique({
      where: { id: senderId },
      select: {
        id: true,
        name: true,
        role: true,
        institutionId: true,
      },
    })

    // ---- Persist the message ----
    // The Message table gained four optional attachment columns in v1.28.0
    // (attachmentUrl, attachmentType, attachmentName, attachmentSize). If a
    // user restored the v1.28.x source over an OLDER database without
    // running `bun run db:push`, the Prisma client (generated from the new
    // schema) will try to write those columns and the SQLite engine will
    // throw "no such column: attachmentUrl". We catch that specific case
    // and retry with a raw SQL insert that omits the attachment columns —
    // this keeps plain-text messaging working even on a stale schema, and
    // the user sees a clear toast prompting them to run `bun run db:push`
    // to unlock attachment support.
    const finalSchoolYear = schoolYear || '2024-2025'
    const hasAttachment = !!attachmentUrl
    const attachType = attachmentType || null
    const attachName = attachmentName || null
    const attachSize =
      typeof attachmentSize === 'number' && !Number.isNaN(attachmentSize)
        ? attachmentSize
        : null

    // We assign to `message` from two code paths (the happy-path Prisma
    // create and the stale-schema raw-SQL fallback) whose structural types
    // differ slightly. `any` keeps the assignment friction-free; the
    // response payload is shaped explicitly when we return it.
    let message: any = null

    try {
      const created = await db.message.create({
        data: {
          senderId,
          receiverId,
          content: text,
          schoolYear: finalSchoolYear,
          attachmentUrl: attachmentUrl || null,
          attachmentType: attachType,
          attachmentName: attachName,
          attachmentSize: attachSize,
        },
        include: {
          sender: {
            select: { id: true, name: true, email: true, role: true, avatar: true, userCode: true },
          },
          receiver: {
            select: { id: true, name: true, email: true, role: true, avatar: true, userCode: true },
          },
        },
      })
      message = created
    } catch (createErr) {
      const errMsg = createErr instanceof Error ? createErr.message : String(createErr)
      // Detect a stale DB schema (missing attachment columns) and retry
      // with a minimal insert that omits them. This lets plain-text
      // messaging keep working on older databases.
      const isMissingColumn =
        /no such column|unknown column|attachmentUrl|attachmentType|attachmentName|attachmentSize/i.test(
          errMsg
        )
      if (!isMissingColumn) {
        // Different error — bubble up with a helpful message.
        console.error('Create message error:', createErr)
        return NextResponse.json(
          {
            error:
              "Erreur lors de l'envoi du message. " +
              'Détail technique : ' + errMsg.slice(0, 300),
          },
          { status: 500 }
        )
      }
      console.warn(
        '[messages] Message table is missing attachment columns — falling back to a minimal insert. ' +
          'Run `bun run db:push` to upgrade the schema.'
      )
      // If the caller tried to send an attachment on a stale schema, we
      // cannot persist it — surface a clear hint BEFORE doing any insert
      // so no orphan row is created.
      if (hasAttachment) {
        return NextResponse.json(
          {
            error:
              'Votre base de données utilise un schéma antérieur à v1.28.0 qui ne supporte pas les pièces jointes. ' +
              'Exécutez `bun run db:push` dans le terminal pour mettre à jour le schéma, puis renvoyez votre pièce jointe.',
          },
          { status: 500 }
        )
      }
      // Plain-text fallback: raw insert without the attachment columns.
      // We then re-fetch with relations so the response shape matches the
      // happy path.
      const now = new Date().toISOString()
      const id = `cm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
      await db.$executeRaw`INSERT INTO Message (id, senderId, receiverId, content, read, schoolYear, createdAt, updatedAt) VALUES (${id}, ${senderId}, ${receiverId}, ${text}, 0, ${finalSchoolYear}, ${now}, ${now})`
      type RawMessageRow = {
        id: string
        senderId: string
        receiverId: string
        content: string
        read: number
        schoolYear: string
        createdAt: string
        updatedAt: string
      }
      const rows = (await db.$queryRaw`SELECT * FROM Message WHERE id = ${id}`) as RawMessageRow[]
      const row = rows[0]
      if (!row) {
        return NextResponse.json(
          { error: "Échec de l'enregistrement du message (schéma obsolète). Exécutez `bun run db:push` puis réessayez." },
          { status: 500 }
        )
      }
      // Fetch sender + receiver for the response payload.
      const [senderRow, receiverRow] = await Promise.all([
        db.user.findUnique({
          where: { id: row.senderId },
          select: { id: true, name: true, email: true, role: true, avatar: true, userCode: true },
        }),
        db.user.findUnique({
          where: { id: row.receiverId },
          select: { id: true, name: true, email: true, role: true, avatar: true, userCode: true },
        }),
      ])
      message = {
        ...row,
        read: !!row.read,
        attachmentUrl: null,
        attachmentType: null,
        attachmentName: null,
        attachmentSize: null,
        sender: senderRow || { id: row.senderId, name: 'Inconnu', email: null, role: '', avatar: null, userCode: null },
        receiver: receiverRow || { id: row.receiverId, name: 'Inconnu', email: null, role: '', avatar: null, userCode: null },
      }
    }

    // ---- Create a notification for the receiver ----
    // `message` is non-null here (either the Prisma create succeeded, or
    // the raw-SQL fallback set it). We guard anyway to satisfy TS.
    if (!message) {
      return NextResponse.json(
        { error: "Échec de l'enregistrement du message." },
        { status: 500 }
      )
    }
    try {
      // The receiver's User row is fetched WITHOUT institutionId (the
      // message response shape doesn't include it), so we rely on the
      // sender's institutionId — which is the same institution for any
      // in-institution conversation.
      const institutionId = sender?.institutionId || 'inst_default'
      // Build a short preview of the message body
      let preview = text
      if (!preview) {
        switch (attachmentType) {
          case 'image':
            preview = '📷 Photo'
            break
          case 'video':
            preview = '🎥 Vidéo'
            break
          case 'audio':
            preview = '🎤 Message vocal'
            break
          default:
            preview = '📎 Pièce jointe'
        }
      }
      await db.notification.create({
        data: {
          userId: receiverId,
          title: `Nouveau message de ${sender?.name || 'Utilisateur'}`,
          message: preview.slice(0, 200),
          type: 'info',
          category: 'message',
          link: 'messages',
          linkParams: senderId,
          icon: 'MessageSquare',
          institutionId,
          schoolYear: schoolYear || '2024-2025',
        },
      })
    } catch (notifErr) {
      // Notification creation must never break message sending
      console.error('Create message notification error:', notifErr)
    }

    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    console.error('Create message error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'envoi du message" },
      { status: 500 }
    )
  }
}
