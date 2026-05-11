# OSRM Map Matching Integration

## Overview

TrikeTrack now integrates **OSRM (Open Source Routing Machine)** to match raw GPS points from tricycle trips to the actual road network. This ensures that trip routes displayed on the admin dashboard follow the real roads instead of appearing as straight lines or inaccurate paths.

## How It Works

### Flow
```
1. Trip completes and GPS points are recorded
2. rebuildTripPathForTrip() function is called (during trip sync or admin request)
3. Raw GPS points are retrieved from trip_points table
4. Validation checks if the trip is suitable for matching (min distance, point count)
5. GPS points are sent to OSRM Map Matching API
6. Matched route geometry is received (road-aligned coordinates)
7. Matched route is stored in trip_paths with metadata
8. Frontend displays the matched route on the map
9. If OSRM fails, fallback to raw GPS points automatically
```

### When OSRM Matching Occurs
- **Automatic:** During trip finalization/sync when the trip path is rebuilt
- **On-Demand:** When an admin opens trip details and the path hasn't been matched yet
- **Non-Real-Time:** Matching happens in background, not on every map view

## Configuration

### Environment Variables
```bash
OSRM_BASE_URL=https://router.project-osrm.org  # Default: public OSRM service
```

### Self-Hosted OSRM (Optional)
For production, consider self-hosting OSRM:
```bash
docker run -it -p 5000:5000 osrm/osrm-backend:v5.27.1 osrm-routed --algorithm mld /data/philippines.osrm
```

Then set:
```bash
OSRM_BASE_URL=http://localhost:5000
```

## Technical Details

### OSRM Service (`osrm-matching.ts`)

**Main Function:**
```typescript
matchTripGPSToRoads(gpsPoints: InputCoordinate[]): Promise<GeoJSON Feature | null>
```

**Validation:**
```typescript
shouldAttemptMatching(gpsPoints: InputCoordinate[]): boolean
```
- Requires minimum 2 GPS points
- Maximum 500 points (prevents noise data)
- Requires minimum distance span of 0.001 degrees (~100 meters)

**API Details:**
- **Endpoint:** `/match/v1/driving/{coordinates}`
- **Request:** GPS coordinates as `longitude,latitude` pairs
- **Response:** Matched route geometry (LineString) with road-aligned coordinates
- **Rate Limit:** Public API has rate limits; self-hosting is recommended for production

### Database Storage

trip_paths table stores matched routes with metadata:
```json
{
  "type": "Feature",
  "geometry": {
    "type": "LineString",
    "coordinates": [[lng, lat], [lng, lat], ...]
  },
  "properties": {
    "source": "osrm_matched_route",
    "pointCount": 150,
    "rawPointCount": 200,
    "matchedAt": "2026-05-10T14:30:00Z"
  }
}
```

## Frontend Display

### Trip Path Modal
- Displays the OSRM-matched route coordinates
- Falls back to raw coordinates if matching failed
- Shows "Matched route not available" message if no data exists

### Map Component (TripPathMap)
- Renders the LineString coordinates
- Automatically uses matched geometry from pathGeojson

## Error Handling

### If OSRM Fails
1. **Automatic Fallback:** Uses raw GPS points
2. **Logging:** Error is logged to console
3. **User Impact:** Minimal - trip still displays, just with raw points

### Common Issues
| Issue | Cause | Solution |
|-------|-------|----------|
| OSRM unreachable | Network issue or invalid URL | Check OSRM_BASE_URL, ensure internet connectivity |
| "Request failed" | Too many requests | Implement request throttling or self-host |
| Empty matched result | GPS points not on road network | Points may be too sparse or in no-GPS areas |

## APIs

### Retrieval Flow
```
GET /api/admin/trips/{tripId}/path
→ getSyncedTripRouteTrace() [checks trips.route_trace_geojson]
→ getTripPathByTripId() [checks trip_paths table]
→ rebuildTripPathForTrip() [rebuilds with OSRM matching]
```

### Response Format
```typescript
{
  ok: true,
  data: {
    tripPathId: 1,
    tripId: 100,
    pointCount: 150,  // Number of matched coordinates
    pathGeojson: {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [[lng, lat], ...]
      },
      properties: {
        source: "osrm_matched_route",
        pointCount: 150,
        rawPointCount: 200,
        matchedAt: "2026-05-10T14:30:00Z"
      }
    },
    startedAt: "2026-05-10T08:00:00Z",
    endedAt: "2026-05-10T08:15:00Z",
    updatedAt: "2026-05-10T14:30:00Z"
  }
}
```

## Performance Considerations

### Caching
- Matched routes are cached in `trip_paths` table
- Subsequent requests for same trip return cached result
- Cache updated only if trip is rebuilt

### Request Limits
- **Public OSRM:** ~600 requests/hour
- **Self-Hosted:** No limits (depends on hardware)

### Optimization Tips
1. **Batch Trip Sync:** Process multiple trips during off-peak hours
2. **Point Limit:** OSRM limits to 100 points per request; trips with >100 points use only first 100
3. **Distance-Based:** Only match trips >100m long (configurable in `shouldAttemptMatching`)

## Troubleshooting

### Check Matched Route Status
```sql
SELECT 
  trip_id,
  point_count,
  path_geojson -> 'properties' ->> 'source' as source,
  path_geojson -> 'properties' ->> 'matchedAt' as matched_at
FROM public.trip_paths
WHERE trip_id = 100;
```

### View Raw vs Matched Coordinates
```sql
SELECT
  path_geojson -> 'properties' ->> 'rawPointCount' as raw_points,
  jsonb_array_length(path_geojson -> 'geometry' -> 'coordinates') as matched_points
FROM public.trip_paths
WHERE trip_id = 100;
```

### Re-Match a Trip
```typescript
// Force rebuild:
await rebuildTripPathForTrip(tripId);
```

## Future Enhancements

- [ ] Add confidence score threshold for matched routes
- [ ] Support for walk/bike modes in addition to driving
- [ ] Batch processing for historical trips
- [ ] Matched route quality metrics
- [ ] Integration with traffic data for estimated times
