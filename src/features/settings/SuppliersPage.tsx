import { useState, useEffect } from 'react'
import { db } from '@db/schema'
import { generateId } from '@shared/utils'
import { useUIStore } from '@stores/uiStore'
import { Button } from '@shared/ui/Button'
import { Modal } from '@shared/ui/Modal'
import type { Supplier } from '@shared/types'

export function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '', address: '', payment_terms: '', notes: '' })
  const showToast = useUIStore(s => s.showToast)

  useEffect(() => {
    loadSuppliers()
  }, [])

  const loadSuppliers = async () => {
    try {
      const all = await db.suppliers.toArray()
      setSuppliers(all)
    } catch { }
  }

  const filtered = search
    ? suppliers.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.contact_person.toLowerCase().includes(search.toLowerCase()) ||
        s.phone.includes(search)
      )
    : suppliers

  const openAdd = () => {
    setEditingId(null)
    setForm({ name: '', contact_person: '', phone: '', email: '', address: '', payment_terms: '', notes: '' })
    setShowForm(true)
  }

  const openEdit = (s: Supplier) => {
    setEditingId(s.id)
    setForm({
      name: s.name,
      contact_person: s.contact_person,
      phone: s.phone,
      email: s.email,
      address: s.address,
      payment_terms: s.payment_terms,
      notes: s.notes,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast('Supplier name is required', 'err')
      return
    }
    try {
      if (editingId) {
        await db.suppliers.update(editingId, form)
        showToast('Supplier updated', 'ok')
      } else {
        await db.suppliers.add({ id: generateId(), ...form })
        showToast('Supplier added', 'ok')
      }
      setShowForm(false)
      loadSuppliers()
    } catch {
      showToast('Failed to save supplier', 'err')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await db.suppliers.delete(id)
      showToast('Supplier deleted', 'ok')
      loadSuppliers()
    } catch {
      showToast('Failed to delete', 'err')
    }
  }

  return (
    <div className="data-page">
      <div className="inv-toolbar" style={{ marginBottom: 12 }}>
        <input
          placeholder="Search suppliers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '6px 10px',
            border: '1px solid var(--bd)',
            borderRadius: 5,
            background: 'var(--s2)',
            color: 'var(--t)',
            fontSize: '.7rem',
            outline: 'none',
            width: 200,
          }}
        />
        <div className="spacer" />
        <Button variant="primary" size="sm" onClick={openAdd}>+ Add Supplier</Button>
      </div>

      <div className="inv-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact Person</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Address</th>
              <th>Payment Terms</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td>{s.contact_person || '—'}</td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: '.65rem' }}>{s.phone || '—'}</td>
                <td style={{ fontSize: '.65rem' }}>{s.email || '—'}</td>
                <td style={{ fontSize: '.65rem', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.address || '—'}</td>
                <td style={{ fontSize: '.65rem' }}>{s.payment_terms || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button variant="ghost" size="xs" onClick={() => openEdit(s)}>Edit</Button>
                    <Button variant="danger" size="xs" onClick={() => handleDelete(s.id)}>Del</Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--t3)', padding: 20 }}>No suppliers found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Edit Supplier' : 'Add Supplier'} wide>
        <div className="form-group">
          <label>Supplier Name *</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="form-group">
            <label>Contact Person</label>
            <input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Payment Terms</label>
            <input value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} placeholder="Net 30, etc." />
          </div>
        </div>
        <div className="form-group">
          <label>Address</label>
          <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
          <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save</Button>
        </div>
      </Modal>
    </div>
  )
}
