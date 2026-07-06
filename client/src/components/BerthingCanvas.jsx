import { useMemo } from 'react';
const MAX_LENGTH = 500;

/**
 * BerthingCanvas — Dock visualization with 2-layer ship blocks.
 * Layer 1 (bottom, near ruler): Active ships (currently at dock)
 * Layer 2 (top): Inactive/pending ships (scheduled but not yet at dock)
 * 
 * Ships are filtered by filterDate — only bookings overlapping that date are shown.
 */

// Posisi Statis Frontal Frame (Pill Hitam)
const STATIC_FRONTAL_FRAMES = [245, 205, 145, 105, 45, 15];

// Posisi dan Warna Statis Fender
const STATIC_FENDERS = [
  { pos: 490, color: '#EF4444' },
  { pos: 470, color: '#EF4444' },
  { pos: 445, color: '#EF4444' },
  { pos: 425, color: '#EF4444' },
  { pos: 405, color: '#EF4444' },
  { pos: 385, color: '#EF4444' },
  { pos: 365, color: '#EF4444' },
  { pos: 340, color: '#EF4444' },
  { pos: 310, color: '#EAB308' },
  { pos: 300, color: '#EAB308' },
  { pos: 290, color: '#EAB308' },
  { pos: 250, color: '#EAB308' },
  { pos: 220, color: '#EAB308' },
  { pos: 200, color: '#EAB308' },
  { pos: 180, color: '#EF4444' },
  { pos: 130, color: '#EAB308' },
  { pos: 110, color: '#EAB308' },
  { pos: 90,  color: '#EAB308' },
  { pos: 50,  color: '#EAB308' },
  { pos: 20,  color: '#EF4444' },
  { pos: 0,   color: '#EF4444' }
];

const SHIP_STATUS_COLORS = {
  pending: '#FCD34D',
  approved: '#34D399',
  rejected: '#F87171',
};

export default function BerthingCanvas({ bookings = [], dockLength = MAX_LENGTH, onShipClick }) {
  
  const ticks = useMemo(() => {
    const arr = [];
    for (let i = 0; i <= dockLength; i += 5) {
      arr.push(i);
    }
    return arr;
  }, [dockLength]);

  /**
   * Assign each ship to a vertical "lane" so that ships whose horizontal
   * positions overlap are stacked in different lanes (rows).
   * Returns ships with a `lane` property + total lane count.
   */
  const assignLanes = (ships) => {
    /**
     * Urutan sort 2 tahap untuk lane yang konsisten:
     * 1. status_request: 'pending' diproses DULU → menempati lane 0 (atas)
     *    baru 'approved' → menumpuk di lane bawahnya (mendekati dermaga)
     * 2. Tie-break: leftPercent ascending (kiri kanvas = meter besar)
     *
     * HTML merender top:0 di atas. Dermaga ada di BAWAH.
     * Jadi kapal Approved harus mendapat lane index yang LBH BESAR agar posisinya
     * di bawah (mepet dermaga).
     */
    const STATUS_PRIORITY = { pending: 0, approved: 1 };
    const sorted = [...ships].sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status_request] ?? 2;
      const pb = STATUS_PRIORITY[b.status_request] ?? 2;
      if (pa !== pb) return pa - pb;          // pending sebelum approved
      return a.leftPercent - b.leftPercent;   // tie-break: kiri ke kanan
    });

    const lanes = [];

    sorted.forEach((ship) => {
      // Gunakan posisi BODY saja (tanpa clearance) untuk deteksi overlap lane.
      // Clearance (5m) ada di KIRI blok (sisi meter tinggi/pos_end).
      const clearW    = ship.clearanceWidthPercent || 0;
      const bodyStart = ship.leftPercent + clearW;
      const bodyEnd   = ship.leftPercent + ship.widthPercent;

      let placed = false;
      for (let i = 0; i < lanes.length; i++) {
        const overlaps = lanes[i].some((other) => {
          const oClearW    = other.clearanceWidthPercent || 0;
          const oBodyStart = other.leftPercent + oClearW;
          const oBodyEnd   = other.leftPercent + other.widthPercent;
          return bodyStart < oBodyEnd && bodyEnd > oBodyStart;
        });
        if (!overlaps) {
          ship.lane = i;
          lanes[i].push(ship);
          placed = true;
          break;
        }
      }
      if (!placed) {
        ship.lane = lanes.length;
        lanes.push([ship]);
      }
    });

    return { ships: sorted, laneCount: Math.max(lanes.length, 1) };
  };

  // Calculate ship block positions and split into 2 groups (active / inactive)
  const CLEARANCE_M = 5; // meter, harus sama dengan konstanta backend
  const { activeData, inactiveData } = useMemo(() => {
    const active = [];
    const inactive = [];

    bookings
      .filter((b) => b.pos_start != null && b.pos_end != null && b.status_request !== 'rejected')
      .forEach((booking) => {
        const posStart = Number(booking.pos_start);
        const posEnd   = Number(booking.pos_end);
        const loa      = booking.loa != null ? Number(booking.loa) : Math.max(posEnd - posStart - CLEARANCE_M, 1);

        const leftPercent          = (((dockLength - Math.max(posStart, posEnd)) / dockLength) * 98) + 1;
        const widthPercent         = (Math.abs(posEnd - posStart) / dockLength) * 98;
        const bodyWidthPercent     = (loa / dockLength) * 98;
        const clearanceWidthPercent = (CLEARANCE_M / dockLength) * 98;
        const isActive             = booking.status === 'active';

        const block = {
          ...booking,
          leftPercent,
          widthPercent:          Math.max(widthPercent, 1.5),
          bodyWidthPercent,
          clearanceWidthPercent,
          color:   SHIP_STATUS_COLORS[booking.status_request] || '#3B82F6',
          isActive,
        };

        if (isActive) {
          active.push(block);
        } else {
          inactive.push(block);
        }
      });

    return {
      activeData:   assignLanes(active),
      inactiveData: assignLanes(inactive),
    };
  }, [bookings, dockLength]);

  const activeShips = activeData.ships;
  const inactiveShips = inactiveData.ships;
  const hasShips = activeShips.length > 0 || inactiveShips.length > 0;

  const LANE_HEIGHT = 38; // px per lane

  const toLeft = (meter) => {
    const percentage = ((dockLength - meter) / dockLength) * 98;
    return `${percentage + 1}%`;
  };

  // Render satu blok kapal: [clearance kiri (arsir)] + [body kanan (berwarna)]
  // Kanvas: meter BESAR di KIRI, meter KECIL di KANAN.
  // pos_end (meter besar) ada di kiri → clearance zone tampil di kiri blok.
  // pos_start (meter kecil) ada di kanan → badan kapal tampil di kanan blok.
  const renderShipBlock = (ship) => {
    const isSolid = ship.isActive;
    const lane    = ship.lane || 0;

    const posStart = Number(ship.pos_start);
    const posEnd   = Number(ship.pos_end);
    const loa      = ship.loa != null ? Number(ship.loa) : Math.max(posEnd - posStart - CLEARANCE_M, 1);
    const totalM   = posEnd - posStart; // total meter blok

    // Persentase masing-masing bagian relatif terhadap LEBAR BLOK (bukan canvas)
    const clearPct = (CLEARANCE_M / totalM) * 100;
    const bodyPct  = (loa / totalM) * 100;

    const totalWidthPercent = Math.max((totalM / dockLength) * 98, 1.5);
    const topPx = lane * LANE_HEIGHT + 2;
    const heightPx = LANE_HEIGHT - 4;

    const borderStyle  = isSolid ? '2.5px solid #000000' : '2px dashed #555555';

    return (
      <div
        key={ship.id_booking}
        className="absolute flex"
        style={{
          left:   `${ship.leftPercent}%`,
          width:  `${totalWidthPercent}%`,
          top:    `${topPx}px`,
          height: `${heightPx}px`,
          zIndex: 10,
        }}
      >
        {/* ── KIRI: Zona Clearance 5m (sisi pos_end / meter tinggi) ── */}
        <div
          style={{
            width:        `${clearPct}%`,
            height:       '100%',
            opacity:      isSolid ? 0.6 : 0.35,
            border:       borderStyle,
            borderRight:  'none',
            borderRadius: '2px 0 0 2px',
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 3px,
              rgba(0,0,0,0.18) 3px,
              rgba(0,0,0,0.18) 5px
            )`,
            backgroundColor: 'rgba(200,200,200,0.25)',
            flexShrink: 0,
          }}
          title={`Zona Clearance 5m — ${ship.nama_kapal}`}
        />

        {/* ── KANAN: Badan Kapal / LOA (sisi pos_start / meter rendah) ── */}
        <div
          className="cursor-pointer hover:brightness-110 transition-all relative flex items-center justify-center overflow-hidden"
          style={{
            width:           `${bodyPct}%`,
            height:          '100%',
            backgroundColor: ship.color,
            opacity:         isSolid ? 1 : 0.6,
            border:          borderStyle,
            borderLeft:      'none',
            borderRadius:    '0 2px 2px 0',
            boxShadow:       isSolid ? '0 2px 6px rgba(0,0,0,0.3)' : 'none',
            flexShrink: 0,
          }}
          title={`${ship.nama_kapal || 'Ship'} | LOA: ${loa}m | Pos: ${posStart}–${posEnd}m | ${ship.status_request}`}
          onClick={() => onShipClick && onShipClick(ship)}
        >
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#000000' }} className="truncate px-1">
            {ship.nama_kapal || ''}
          </span>
        </div>
      </div>
    );
  };


  return (
    <div className="w-full overflow-x-auto pb-2 select-none" style={{ touchAction: 'pan-x' }}>
      <div style={{ width: '1200px', margin: '0 auto', padding: '3px' }}>

        {/* ================= LAYER 2 (ATAS): Inactive/Pending Ships ================= */}
        {inactiveShips.length > 0 && (
          <div className="relative w-full mb-0.5" style={{ height: `${inactiveData.laneCount * LANE_HEIGHT + 4}px` }}>
          {inactiveShips.map(renderShipBlock)}
          </div>
        )}

        {/* ================= LAYER 1 (BAWAH, mepet ruler): Active Ships ================= */}
        {activeShips.length > 0 && (
          <div className="relative w-full mb-1" style={{ height: `${activeData.laneCount * LANE_HEIGHT + 4}px` }}>
            {activeShips.map(renderShipBlock)}
          </div>
        )}

        {/* Spacer if no ships */}
        {!hasShips && <div style={{ height: '8px' }} />}
        
        {/* CONTAINER UTAMA KANVAS */}
        <div className="relative flex flex-col bg-white border-[2.3px] border-black rounded-sm overflow-hidden shadow-sm">
          
          {/* ================= RULER AREA ================= */}
          <div className="relative w-full border-b-[2px] border-black bg-white" style={{ height: '85px' }}>
            
            {/* Frontal Frames Statis */}
            {STATIC_FRONTAL_FRAMES.map((pos) => (
              <div
                key={`ff-${pos}`}
                className="absolute bg-black rounded-full z-10"
                style={{
                  left: toLeft(pos),
                  top: '-2px',
                  width: '34px',
                  height: '8px',
                  transform: 'translateX(-50%)',
                }}
              />
            ))}

            {/* Ticks */}
            {ticks.map((pos) => {
              const isMajor = pos % 10 === 0;
              return (
                <div
                  key={`tick-${pos}`}
                  className="absolute top-0 bg-black"
                  style={{
                    left: toLeft(pos),
                    width: isMajor ? '1px' : '0.5px',
                    height: isMajor ? '35px' : '20px',
                    transform: 'translateX(-50%)',
                  }}
                />
              );
            })}

            {/* Garis pembatas 350m */}
            <div 
              className="absolute top-0 bottom-0 bg-black z-10" 
              style={{ left: toLeft(350), width: '1px', transform: 'translateX(-50%)' }} 
            />

            {/* Fender Statis */}
            {STATIC_FENDERS.map((fender, i) => (
              <div
                key={`f-${i}`}
                className="absolute border border-black rounded-[1px]"
                style={{
                  left: toLeft(fender.pos),
                  bottom: '24px',
                  width: '9px',
                  height: '16px',
                  background: fender.color,
                  transform: 'translateX(-50%)',
                }}
              />
            ))}

            {/* Angka Skala */}
            {ticks.map((pos) => {
              if (pos % 10 !== 0) return null;
              return (
                <span
                  key={`num-${pos}`}
                  className="absolute text-black font-bold"
                  style={{
                    left: toLeft(pos),
                    bottom: '4px',
                    transform: 'translateX(-50%)',
                    fontSize: '10px',
                    lineHeight: '1',
                  }}
                >
                  {pos}
                </span>
              );
            })}
          </div>

          {/* ================= DOCK AREA (DERMAGA TIMUR) ================= */}
          <div className="relative w-full bg-[#5b9bd5] flex items-center justify-center border-black" style={{ height: '80px' }}>
            <span className="text-white font-bold pointer-events-none select-none" style={{ fontSize: '24px' }}>
              DERMAGA TIMUR
            </span>

            {/* Legend Box */}
            <div className="absolute right-1 top-1/2 -translate-y-1/2 bg-white border-[2px] border-black rounded-sm p-1 flex flex-col gap-1 shadow-md z-20" style={{ width: '90px' }}>
              <div className="flex items-center gap-1">
                <div className="w-[10px] h-[14px] bg-[#EAB308] border border-black" />
                <span className="text-[9px] font-black text-black leading-none">50 TON</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-[10px] h-[14px] bg-[#EF4444] border border-black" />
                <span className="text-[9px] font-black text-black leading-none">150 TON</span>
              </div>
              <div className="flex items-center gap-2 border-gray-300">
                <div className="w-4 h-1.5 bg-black rounded-full" />
                <span className="text-[8px] font-black text-black leading-tight">FRONTAL<br/>FRAME</span>
              </div>
              <div className="flex items-center gap-1 border-gray-300">
                <div className="w-[10px] h-[14px] border border-black" style={{
                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.25) 2px, rgba(0,0,0,0.25) 4px)',
                  backgroundColor: 'rgba(200,200,200,0.3)',
                }} />
                <span className="text-[8px] font-black text-black leading-tight">CLEARANCE 5M</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
