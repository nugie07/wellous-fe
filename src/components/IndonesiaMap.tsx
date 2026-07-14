import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet"

export type MapPoint = {
  lat: number
  lng: number
  label: string
  count: number
}

type IndonesiaMapProps = {
  points: MapPoint[]
  className?: string
}

export function IndonesiaMap({ points, className = "" }: IndonesiaMapProps) {
  const center: [number, number] = [-2.5, 118] // Indonesia
  const zoom = 5

  return (
    <div className={className} style={{ height: "100%", minHeight: 280 }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%", borderRadius: 10 }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((point) => (
          <Marker
            key={`${point.lat}-${point.lng}`}
            position={[point.lat, point.lng]}
            icon={L.divIcon({
              className: "border-0 bg-transparent",
              html: `
                <div style="
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  width: 36px;
                  height: 36px;
                  background: #3f7f8f;
                  color: #fff;
                  font-size: 12px;
                  font-weight: 700;
                  border-radius: 50%;
                  border: 2px solid #fff;
                  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                ">${point.count}</div>
              `,
              iconSize: [36, 36],
              iconAnchor: [18, 18],
            })}
          >
            <Popup>
              <strong>{point.label}</strong>
              <br />
              {point.count} leads
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
