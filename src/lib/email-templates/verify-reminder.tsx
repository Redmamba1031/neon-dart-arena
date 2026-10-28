import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  verifyUrl?: string
}

const Email = ({ name, verifyUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Verify your age and ID to unlock paid matches on SMYD</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>One step left to play for cash</Heading>
        <Text style={text}>{name ? `Hi ${name},` : 'Hi there,'}</Text>
        <Text style={text}>
          Your SMYD account is almost ready. To join paid 1v1 matches and
          enter the $500 monthly tournament, we need to verify your age and a
          photo ID. It takes about a minute.
        </Text>
        <Button style={button} href={verifyUrl || 'https://smyd.online/verify-identity'}>
          Verify my account
        </Button>
        <Text style={text}>
          Until you're verified you can still browse the lobby and
          leaderboard — paid play unlocks as soon as verification passes.
        </Text>
        <Text style={footer}>
          You're receiving this because you created a SMYD account and
          haven't completed verification yet.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Finish verifying your SMYD account',
  displayName: 'Verification reminder',
  previewData: { name: 'Jane', verifyUrl: 'https://smyd.online/verify-identity' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#000000',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const button = {
  backgroundColor: '#000000',
  color: '#ffffff',
  fontSize: '14px',
  border: '1px solid #000000',
  borderRadius: '8px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
