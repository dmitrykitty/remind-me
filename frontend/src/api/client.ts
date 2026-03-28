import type { AppSettings, KnownObject, Person } from "./types";

const BASE = "";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

// ---- People ----

export async function listPeople(): Promise<Person[]> {
  return json(await fetch(`${BASE}/api/people`));
}

export async function createPerson(data: {
  name: string;
  relationship_label?: string;
  notes?: string;
}): Promise<Person> {
  return json(
    await fetch(`${BASE}/api/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  );
}

export async function deletePerson(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/people/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

export async function addPersonSamples(
  personId: string,
  files: Blob[],
): Promise<Person> {
  const fd = new FormData();
  files.forEach((blob, i) => fd.append("files", blob, `photo_${i}.jpg`));
  return json(
    await fetch(`${BASE}/api/people/${personId}/samples`, {
      method: "POST",
      body: fd,
    }),
  );
}

// ---- Objects ----

export async function listObjects(): Promise<KnownObject[]> {
  return json(await fetch(`${BASE}/api/objects`));
}

export async function createObject(data: {
  name: string;
  category?: string;
  notes?: string;
}): Promise<KnownObject> {
  return json(
    await fetch(`${BASE}/api/objects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  );
}

export async function deleteObject(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/objects/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

export async function addObjectSamples(
  objectId: string,
  files: Blob[],
): Promise<KnownObject> {
  const fd = new FormData();
  files.forEach((blob, i) => fd.append("files", blob, `photo_${i}.jpg`));
  return json(
    await fetch(`${BASE}/api/objects/${objectId}/samples`, {
      method: "POST",
      body: fd,
    }),
  );
}

// ---- Settings ----

export async function getSettings(): Promise<AppSettings> {
  return json(await fetch(`${BASE}/api/settings`));
}

export async function updateSettings(
  data: Partial<AppSettings>,
): Promise<AppSettings> {
  return json(
    await fetch(`${BASE}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  );
}

// ---- Memory ----

export async function resetMemory(): Promise<void> {
  const res = await fetch(`${BASE}/api/memory/reset`, { method: "POST" });
  if (!res.ok) throw new Error(`Reset failed: ${res.status}`);
}
