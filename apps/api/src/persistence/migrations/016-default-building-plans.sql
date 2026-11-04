-- Explicit building association and schematic plans; existing drawings remain intact.
ALTER TABLE warehouse.floor_plans ADD COLUMN building_id text;
ALTER TABLE warehouse.floor_plans ADD COLUMN is_default boolean DEFAULT false;
ALTER TABLE warehouse.floor_plans ADD CONSTRAINT floor_plans_building_scope_fk
  FOREIGN KEY(building_id,property_id) REFERENCES warehouse.buildings(id,property_id)
  DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE warehouse.floor_plans ADD CONSTRAINT floor_plans_kind_valid
  CHECK(kind IS NULL OR kind IN ('site','building','floor')) NOT VALID;
ALTER TABLE warehouse.floor_plans ADD CONSTRAINT floor_plans_building_level_valid
  CHECK(kind IS DISTINCT FROM 'building' OR (building_id IS NOT NULL AND floor_id IS NULL)) NOT VALID;
ALTER TABLE warehouse.floor_plans ADD CONSTRAINT floor_plans_default_level_valid
  CHECK(is_default IS NOT TRUE OR (kind IN ('site','building') AND floor_id IS NULL));

CREATE UNIQUE INDEX floor_plans_default_site_unique ON warehouse.floor_plans(property_id)
  WHERE is_default IS TRUE AND kind='site';
CREATE UNIQUE INDEX floor_plans_default_building_unique ON warehouse.floor_plans(building_id)
  WHERE is_default IS TRUE AND kind='building';

-- Create all schema objects before updating rows: deferred FK checks from those
-- updates must not leave pending trigger events while creating indexes/triggers.
-- Floor ownership is derived from its entrance. Deferrable checks permit an
-- atomic entrance/floor move with matching plan association updates.
CREATE FUNCTION warehouse.assert_floor_plan_building_context() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM warehouse.floor_plans p
    JOIN warehouse.floors f ON f.id=p.floor_id
    JOIN warehouse.entrances e ON e.id=f.entrance_id
    WHERE p.building_id IS DISTINCT FROM e.building_id
  ) THEN
    RAISE EXCEPTION 'Floor plan belongs to another building' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER floor_plans_building_context
  AFTER INSERT OR UPDATE ON warehouse.floor_plans DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION warehouse.assert_floor_plan_building_context();
CREATE CONSTRAINT TRIGGER floors_plan_building_context
  AFTER UPDATE ON warehouse.floors DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION warehouse.assert_floor_plan_building_context();
CREATE CONSTRAINT TRIGGER entrances_plan_building_context
  AFTER UPDATE ON warehouse.entrances DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION warehouse.assert_floor_plan_building_context();

UPDATE warehouse.floor_plans p SET building_id=e.building_id
FROM warehouse.floors f JOIN warehouse.entrances e ON e.id=f.entrance_id
WHERE p.floor_id=f.id;

-- Missing means no usable drawing, background or unit markers. Blank legacy
-- records are retained beside the new default rather than rewritten.
WITH missing AS (
  SELECT 'site'::text AS kind,p.id AS property_id,NULL::text AS building_id,p.id AS entity_id
  FROM warehouse.properties p
  WHERE NOT EXISTS (
    SELECT 1 FROM warehouse.floor_plans fp
    WHERE fp.property_id=p.id AND fp.floor_id IS NULL AND fp.building_id IS NULL
      AND coalesce(fp.kind,'site')='site'
      AND ((CASE WHEN jsonb_typeof(fp.geometry)='array' THEN jsonb_array_length(fp.geometry) ELSE 0 END)>0
        OR btrim(coalesce(fp.image,''))<>''
        OR (CASE WHEN jsonb_typeof(fp.markers)='array' THEN jsonb_array_length(fp.markers) ELSE 0 END)>0)
  )
  UNION ALL
  SELECT 'building',b.property_id,b.id,b.id
  FROM warehouse.buildings b
  WHERE NOT EXISTS (
    SELECT 1 FROM warehouse.floor_plans fp
    WHERE fp.property_id=b.property_id AND fp.building_id=b.id AND fp.floor_id IS NULL AND fp.kind='building'
      AND ((CASE WHEN jsonb_typeof(fp.geometry)='array' THEN jsonb_array_length(fp.geometry) ELSE 0 END)>0
        OR btrim(coalesce(fp.image,''))<>''
        OR (CASE WHEN jsonb_typeof(fp.markers)='array' THEN jsonb_array_length(fp.markers) ELSE 0 END)>0)
  )
), candidates AS (
  SELECT m.*,candidate.id
  FROM missing m CROSS JOIN LATERAL (
    SELECT md5('wirehouse:default-floorplan:'||m.kind||':'||m.entity_id||CASE WHEN attempt=0 THEN '' ELSE ':'||attempt END)::uuid::text AS id
    FROM generate_series(0,31) AS attempts(attempt)
    WHERE NOT EXISTS (
      SELECT 1 FROM warehouse.floor_plans occupied
      WHERE occupied.id=md5('wirehouse:default-floorplan:'||m.kind||':'||m.entity_id||CASE WHEN attempt=0 THEN '' ELSE ':'||attempt END)::uuid::text
    ) ORDER BY attempt LIMIT 1
  ) candidate
)
INSERT INTO warehouse.floor_plans(id,property_id,building_id,floor_id,kind,name,image,geometry,layers,markers,source_name,is_default,version,created_by,created_at,updated_at)
SELECT id,property_id,building_id,NULL,kind,
  CASE WHEN kind='building' THEN 'План здания' ELSE 'План объекта' END,
  '',
  '[{"id":"building-outline","layer":"BUILDING","type":"polygon","points":[{"x":100,"y":100},{"x":900,"y":100},{"x":900,"y":900},{"x":100,"y":900}]}]'::jsonb,
  '["BUILDING"]'::jsonb,'[]'::jsonb,'default-square.dxf',true,1,NULL,now(),now()
FROM candidates;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM warehouse.properties p WHERE NOT EXISTS (
      SELECT 1 FROM warehouse.floor_plans fp
      WHERE fp.property_id=p.id AND fp.floor_id IS NULL AND fp.building_id IS NULL AND coalesce(fp.kind,'site')='site'
        AND ((CASE WHEN jsonb_typeof(fp.geometry)='array' THEN jsonb_array_length(fp.geometry) ELSE 0 END)>0 OR btrim(coalesce(fp.image,''))<>'' OR (CASE WHEN jsonb_typeof(fp.markers)='array' THEN jsonb_array_length(fp.markers) ELSE 0 END)>0)
    )
  ) OR EXISTS (
    SELECT 1 FROM warehouse.buildings b WHERE NOT EXISTS (
      SELECT 1 FROM warehouse.floor_plans fp
      WHERE fp.property_id=b.property_id AND fp.building_id=b.id AND fp.floor_id IS NULL AND fp.kind='building'
        AND ((CASE WHEN jsonb_typeof(fp.geometry)='array' THEN jsonb_array_length(fp.geometry) ELSE 0 END)>0 OR btrim(coalesce(fp.image,''))<>'' OR (CASE WHEN jsonb_typeof(fp.markers)='array' THEN jsonb_array_length(fp.markers) ELSE 0 END)>0)
    )
  ) THEN RAISE EXCEPTION 'Could not assign a default building plan'; END IF;
END;
$$;
