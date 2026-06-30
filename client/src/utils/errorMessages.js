// Centralized error parser for API responses.
//
// Converts raw axios errors / backend error envelopes into user-friendly,
// Indonesian-language messages, plus optional field-level errors and
// conflict details. Forms should not display backend `error.message` directly.

const FIELD_LABELS = {
  username: 'Username',
  password: 'Password',
  agency_name: 'Nama perusahaan',
  npwp: 'NPWP',
  company_address: 'Alamat perusahaan',
  phone_number: 'Nomor telepon',
  email: 'Email',
  employee_id: 'Employee ID',
  name: 'Nama',
  user_role: 'Role',
  nama_kapal: 'Nama kapal',
  loa: 'LOA',
  gt: 'GT',
  type: 'Tipe kapal',
  call_sign: 'Call sign',
  keterangan: 'Keterangan',
  id_kapal: 'Kapal',
  id_agen: 'Agen',
  pos_start: 'Posisi awal',
  eta_in: 'Waktu kedatangan (ETA/IN)',
  etd_out: 'Waktu keberangkatan (ETD/OUT)',
  pbm: 'PBM',
  new_etd_out: 'ETD baru',
};

function fieldLabel(field) {
  return FIELD_LABELS[field] || field;
}

// Translate a raw Joi/validator message into something readable.
function translateFieldMessage(field, rawMessage = '') {
  const label = fieldLabel(field);
  const m = String(rawMessage).toLowerCase();

  if (m.includes('required') || m.includes('is required')) return `${label} wajib diisi.`;
  if (m.includes('must be a number')) return `${label} harus berupa angka.`;
  if (m.includes('must be a positive') || m.includes('greater than 0')) return `${label} harus lebih besar dari 0.`;
  if (m.includes('must be a valid email')) return 'Format email tidak valid.';
  if (m.includes('length must be at least')) {
    const match = rawMessage.match(/at least (\d+)/i);
    return match ? `${label} minimal ${match[1]} karakter.` : `${label} terlalu pendek.`;
  }
  if (m.includes('length must be less than')) {
    const match = rawMessage.match(/less than(?: or equal to)? (\d+)/i);
    return match ? `${label} maksimal ${match[1]} karakter.` : `${label} terlalu panjang.`;
  }
  if (m.includes('must be one of')) return `${label} tidak valid.`;
  if (m.includes('must be a valid date')) return `${label} bukan tanggal yang valid.`;

  // Generic fallback
  return `${label} tidak valid.`;
}

// Map backend `code` + raw message to a friendly Indonesian message,
// using `context.entity` to disambiguate generic codes (NOT_FOUND, INTEGRITY_CONSTRAINT).
function lookupMessage({ code, rawMessage, status, context }) {
  const entity = context?.entity; // 'booking' | 'ship' | 'agent' | 'officer' | 'notification'
  const action = context?.action; // 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'extend'

  // Pre-formatted overrides for context-aware codes
  const entityNames = {
    booking: 'Booking',
    ship: 'Kapal',
    agent: 'Agen',
    officer: 'Petugas',
    notification: 'Notifikasi',
  };
  const entityName = entityNames[entity] || 'Data';

  switch (code) {
    case 'AUTH_INVALID':
      // Login flow uses this code for wrong credentials
      if (rawMessage?.toLowerCase().includes('credentials')) {
        return 'Username atau password salah.';
      }
      return 'Sesi Anda tidak valid. Silakan login kembali.';

    case 'AUTH_EXPIRED':
      return 'Sesi Anda sudah berakhir. Silahkan login kembali.';

    case 'FORBIDDEN':
      return 'Anda tidak punya akses untuk melakukan aksi ini.';

    case 'NOT_FOUND':
      return `${entityName} tidak ditemukan.`;

    case 'INVALID_STATUS': {
      // Action-specific
      if (action === 'approve') return 'Booking ini sudah tidak dalam status pending, jadi tidak bisa disetujui.';
      if (action === 'reject') return 'Booking ini sudah tidak dalam status pending, jadi tidak bisa ditolak.';
      if (action === 'extend') return 'Hanya booking yang sudah disetujui yang dapat diperpanjang.';
      if (action === 'editPosition') return 'Hanya booking yang masih pending yang posisinya bisa diedit.';
      // Fallback to raw if includes ETD hint
      if (rawMessage?.toLowerCase().includes('after current departure')) {
        return 'Waktu keberangkatan baru harus setelah ETD saat ini.';
      }
      if (rawMessage?.toLowerCase().includes('no pending extend')) {
        return 'Tidak ada permintaan perpanjangan yang menunggu untuk booking ini.';
      }
      return 'Aksi ini tidak bisa dilakukan pada status booking saat ini.';
    }

    case 'VALIDATION_CAPACITY': {
      // Backend may include hint like "POS_END exceeds dock capacity (500m)"
      if (rawMessage?.toLowerCase().includes('exceeds dock capacity')) {
        return 'Posisi yang dipilih melewati ujung dermaga (500 m). Coba posisi awal yang lebih kecil.';
      }
      if (rawMessage?.toLowerCase().includes('cannot be negative')) {
        return 'Posisi awal tidak boleh negatif.';
      }
      return 'Posisi melebihi kapasitas dermaga. Coba posisi awal yang lebih kecil.';
    }

    case 'VALIDATION_CONFLICT':
      return 'Posisi atau waktu yang Anda pilih bentrok dengan booking lain. Lihat detail di bawah.';

    case 'VALIDATION_FIELDS': {
      // Could be field-level (handled separately) or known specific message
      const m = rawMessage?.toLowerCase() || '';
      if (m.includes('username already exists')) return 'Username sudah dipakai. Coba username lain.';
      if (m.includes('employee id already exists')) return 'Employee ID sudah terdaftar.';
      if (m.includes('referenced agent does not exist')) return 'Agen yang dipilih tidak ditemukan. Refresh halaman lalu coba lagi.';
      if (m.includes('eta/in')) return 'Waktu kedatangan (ETA/IN) tidak boleh di waktu yang sudah lewat.';
      if (m.includes('new departure time must be after')) return 'Waktu keberangkatan baru harus setelah ETD saat ini.';
      if (m.includes('invalid notification id')) return 'ID notifikasi tidak valid.';
      // Generic
      return 'Ada isian yang belum benar. Mohon periksa kembali.';
    }

    case 'INTEGRITY_CONSTRAINT': {
      const m = rawMessage?.toLowerCase() || '';
      if (m.includes('ship with existing bookings')) return 'Kapal ini masih punya booking aktif, jadi belum bisa dihapus.';
      if (m.includes('agent with existing ships')) return 'Agen ini masih punya kapal terdaftar, jadi belum bisa dihapus.';
      if (m.includes('agent with existing bookings')) return 'Agen ini masih punya booking aktif, jadi belum bisa dihapus.';
      return 'Data ini masih dipakai oleh data lain, jadi belum bisa dihapus.';
    }

    case 'RECAPTCHA_FAILED':
      return 'Verifikasi reCAPTCHA gagal. Mohon centang ulang.';

    case 'INTERNAL':
      return 'Terjadi gangguan di server. Coba lagi sebentar lagi.';

    default:
      // Status-based fallback
      if (status === 401) return 'Sesi Anda berakhir. Silakan login kembali.';
      if (status === 403) return 'Anda tidak punya akses untuk melakukan aksi ini.';
      if (status === 404) return `${entityName} tidak ditemukan.`;
      if (status === 409) return 'Data bertentangan dengan data yang sudah ada.';
      if (status === 422) return 'Ada isian yang belum benar. Mohon periksa kembali.';
      if (status >= 500) return 'Terjadi gangguan di server. Coba lagi sebentar lagi.';
      // Unknown
      return 'Terjadi kesalahan. Coba lagi nanti.';
  }
}

/**
 * Parse an axios error into user-friendly pieces.
 *
 * @param {unknown} err - The error thrown by axios.
 * @param {{ entity?: string, action?: string }} context - Hints to disambiguate generic codes.
 * @returns {{ message: string, fieldErrors: Record<string, string>, conflicts: any[], code: string|null }}
 */
export function parseApiError(err, context = {}) {
  // Network error (no response from server)
  if (!err || !err.response) {
    // Distinguish between aborted/timeout vs generic network
    if (err?.code === 'ECONNABORTED') {
      return {
        message: 'Permintaan terlalu lama. Periksa koneksi lalu coba lagi.',
        fieldErrors: {},
        conflicts: [],
        code: null,
      };
    }
    return {
      message: 'Tidak bisa terhubung ke server. Cek koneksi Anda lalu coba lagi.',
      fieldErrors: {},
      conflicts: [],
      code: null,
    };
  }

  const status = err.response.status;
  const errorData = err.response.data?.error || {};
  const code = errorData.code || null;
  const rawMessage = errorData.message || '';
  const details = errorData.details;

  // Build per-field errors when backend sent field details
  let fieldErrors = {};
  if (code === 'VALIDATION_FIELDS' && Array.isArray(details)) {
    fieldErrors = details.reduce((acc, d) => {
      if (d?.field) {
        acc[d.field] = translateFieldMessage(d.field, d.message);
      }
      return acc;
    }, {});
  }

  // Conflict list (from VALIDATION_CONFLICT)
  const conflicts =
    code === 'VALIDATION_CONFLICT' && details && Array.isArray(details.conflicts)
      ? details.conflicts
      : [];

  const message = lookupMessage({ code, rawMessage, status, context });

  return { message, fieldErrors, conflicts, code };
}

/**
 * Format conflict entries for human-readable display.
 *
 * @param {Array<{nama_kapal?: string, pos_start?: number|string, pos_end?: number|string, eta_in?: string, etd_out?: string}>} conflicts
 * @returns {string[]} An array of formatted lines, one per conflict.
 */
export function formatConflicts(conflicts) {
  if (!Array.isArray(conflicts) || conflicts.length === 0) return [];
  const fmt = (iso) =>
    iso
      ? new Date(iso).toLocaleString('id-ID', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;
  return conflicts.map((c) => {
    const ship = c.nama_kapal || 'Booking lain';
    const pos = c.pos_start != null && c.pos_end != null ? ` posisi ${Math.round(Number(c.pos_start))}–${Math.round(Number(c.pos_end))} m` : '';
    const eta = fmt(c.eta_in);
    const etd = fmt(c.etd_out);
    const time = eta && etd ? `, ${eta} – ${etd}` : '';
    return `${ship}${pos}${time}`;
  });
}
