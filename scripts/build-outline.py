# Merges the 75 districts into one outline of UP, used to hide the map outside the state.
import json
from shapely.geometry import shape
from shapely.ops import unary_union

geo = json.load(open('public/data/up.geojson'))
merged = unary_union([shape(f['geometry']).buffer(0) for f in geo['features']]).buffer(.004).buffer(-.004).simplify(.002)
parts = list(getattr(merged, 'geoms', [merged]))
# Outer rings only, so slivers between districts cannot show through as holes
rings = [[[[round(x, 4), round(y, 4)] for x, y in p.exterior.coords]] for p in parts]
json.dump({'type': 'MultiPolygon', 'coordinates': rings}, open('public/data/up-outline.geojson', 'w'), separators=(',', ':'))
