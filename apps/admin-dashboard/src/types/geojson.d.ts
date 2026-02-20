type LineStringGeometry = {
  type: "LineString";
  coordinates: Array<[number, number]>;
};

type PolygonGeometry = {
  type: "Polygon";
  coordinates: Array<Array<[number, number]>>;
};

export type GeoJSON = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, unknown>;
    geometry: LineStringGeometry | PolygonGeometry;
  }>;
};
