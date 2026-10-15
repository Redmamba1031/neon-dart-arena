import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  design?: string; size?: string; jerseyName?: string; number?: string
  quantity?: string; amount?: string; buyerEmail?: string; shipping?: string; sessionId?: string
}

function JerseyOrder(p: Props) {
  const rows: [string, string | undefined][] = [
    ['Design', p.design], ['Size', p.size], ['Jersey name', p.jerseyName], ['Number', p.number || '(none)'],
    ['Quantity', p.quantity], ['Paid', p.amount], ['Buyer', p.buyerEmail], ['Ship to', p.shipping], ['Order ref', p.sessionId],
  ]
  return (
    <Html lang="en"><Head /><Preview>New SMYD jersey order</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
        <Container style={{ padding: '24px' }}>
          <Heading style={{ fontSize: '22px', color: '#111' }}>New jersey order 🎯</Heading>
          {rows.map(([k, v]) => (
            <Text key={k} style={{ fontSize: '14px', color: '#333', margin: '4px 0' }}><b>{k}:</b> {v || '—'}</Text>
          ))}
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: JerseyOrder,
  subject: (d: Record<string, any>) => `New jersey order: ${d.design ?? ''} ${d.size ?? ''} ${d.jerseyName ?? ''}`.trim(),
  displayName: 'Jersey order (owner alert)',
  previewData: { design: 'Neon Voltage', size: 'L', jerseyName: 'REDMOND', number: '7', quantity: '1', amount: '$45.00', buyerEmail: 'player@example.com', shipping: '123 Main St, Indianapolis, IN 46204, US' },
} satisfies TemplateEntry
