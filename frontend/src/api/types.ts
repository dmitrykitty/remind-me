// ---- API response types matching backend schemas ----

export interface FaceBBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RecognizedFace {
  person_id: string;
  name: string;
  relationship_label: string;
  notes: string;
  confidence: number;
  bbox: FaceBBox;
}

export interface UnknownFace {
  face_id: string;
  bbox: FaceBBox;
  crop_base64: string;
}

export interface RecognizedObject {
  object_id: string;
  name: string;
  category: string;
  notes: string;
  confidence: number;
}

export interface RecognitionResult {
  faces: RecognizedFace[];
  unknown_faces: UnknownFace[];
  objects: RecognizedObject[];
  frame_width: number;
  frame_height: number;
  processing_ms: number;
  error?: string;
}

// ---- CRUD types ----

export interface PersonPhoto {
  id: string;
  photo_path: string;
  sample_index: number;
  created_at: string;
}

export interface Person {
  id: string;
  name: string;
  relationship_label: string;
  notes: string;
  created_at: string;
  updated_at: string;
  photos: PersonPhoto[];
}

export interface KnownObjectPhoto {
  id: string;
  photo_path: string;
  sample_index: number;
  created_at: string;
}

export interface KnownObject {
  id: string;
  name: string;
  category: string;
  notes: string;
  created_at: string;
  updated_at: string;
  photos: KnownObjectPhoto[];
}

export interface AppSettings {
  face_distance_threshold: number;
  object_distance_threshold: number;
  frame_interval_ms: number;
  face_recognition_enabled: boolean;
  object_recognition_enabled: boolean;
}
