import { useState, useEffect, useCallback } from 'react'
import { db } from '@db/schema'
import type { User } from '@shared/types'

interface PinLoginProps {
  user: User
  onSuccess: () => void
  onLogout: () => void
}

export function PinLogin({ user, onSuccess, onLogout }: PinLoginProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(0)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (lockedUntil > Date.now()) {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000)
      setCountdown(remaining)
      const id = setInterval(() => {
        const rem = Math.ceil((lockedUntil - Date.now()) / 1000)
        if (rem <= 0) {
          setCountdown(0)
          setLockedUntil(0)
          clearInterval(id)
        } else {
          setCountdown(rem)
        }
      }, 1000)
      return () => clearInterval(id)
    }
  }, [lockedUntil])

  const validatePin = useCallback(async () => {
    if (pin.length < 4) {
      setError('PIN must be 4-6 digits')
      return
    }
    try {
      const stored = await db.users.get(user.id)
      if (stored && stored.pin === pin) {
        setAttempts(0)
        onSuccess()
      } else {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        setPin('')
        if (newAttempts >= 5) {
          setLockedUntil(Date.now() + 60000)
          setError('Too many attempts. Locked for 60s.')
        } else {
          setError(`Incorrect PIN (${5 - newAttempts} attempts remaining)`)
        }
      }
    } catch {
      setError('Error validating PIN')
    }
  }, [pin, attempts, user.id, onSuccess])

  const handleKeyPress = useCallback((key: string) => {
    if (lockedUntil > Date.now()) return
    setError('')

    if (key === 'backspace') {
      setPin(p => p.slice(0, -1))
    } else if (key === 'enter') {
      validatePin()
    } else if (pin.length < 6) {
      setPin(p => p + key)
    }
  }, [pin, lockedUntil, validatePin])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key)
      } else if (e.key === 'Backspace') {
        handleKeyPress('backspace')
      } else if (e.key === 'Enter') {
        handleKeyPress('enter')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleKeyPress])

  if (countdown > 0) {
    return (
      <div className="pin-screen">
        <div className="pin-box">
          <div className="pin-avatar">{user.name.charAt(0).toUpperCase()}</div>
          <div className="pin-name">{user.name}</div>
          <div className="pin-locked">Locked for {countdown}s</div>
        </div>
      </div>
    )
  }

  return (
    <div className="pin-screen">
      <div className="pin-box">
        <div className="pin-avatar">{user.name.charAt(0).toUpperCase()}</div>
        <div className="pin-name">{user.name}</div>
        <div className="pin-role">{user.role}</div>

        <div className="pin-dots">
          {Array.from({ length: pin.length }, (_, i) => (
            <span key={i} className="pin-dot filled" />
          ))}
          {Array.from({ length: 6 - pin.length }, (_, i) => (
            <span key={pin.length + i} className="pin-dot" />
          ))}
        </div>

        {error && <div className="pin-error">{error}</div>}

        <div className="pin-pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <button
              key={n}
              className="pin-key"
              onClick={() => handleKeyPress(String(n))}
              disabled={lockedUntil > Date.now()}
            >
              {n}
            </button>
          ))}
          <button
            className="pin-key pin-key-blank"
            disabled={lockedUntil > Date.now()}
          />
          <button
            className="pin-key"
            onClick={() => handleKeyPress('0')}
            disabled={lockedUntil > Date.now()}
          >
            0
          </button>
          <button
            className="pin-key pin-key-bs"
            onClick={() => handleKeyPress('backspace')}
            disabled={lockedUntil > Date.now()}
          >
            ⌫
          </button>
        </div>

        <button className="pin-enter" onClick={validatePin} disabled={pin.length < 4}>
          Enter
        </button>

        <button className="pin-logout" onClick={onLogout}>
          Switch User
        </button>
      </div>
    </div>
  )
}
