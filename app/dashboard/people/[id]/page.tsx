"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Person = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_path: string | null;
};

type AudioFile = {
  id: string;
  person_id: string;
  title: string;
  description: string | null;
  file_path: string;
  created_at: string;
};

export default function PersonManagementPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const personId = params.id as string;

  const [person, setPerson] = useState<Person | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingImage, setDeletingImage] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  const [uploadedAudioFiles, setUploadedAudioFiles] = useState<AudioFile[]>([]);
  const [loadingAudio, setLoadingAudio] = useState(true);

  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});


  function handleAudioChange(event: ChangeEvent<HTMLInputElement>) {
  const files = Array.from(event.target.files || []);

  if (files.length === 0) {
    return;
  }

  const allowedTypes = [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/mp4",
    "audio/x-m4a",
    "audio/aac",
    "audio/ogg",
    "audio/webm",
  ];

  const invalidFile = files.find(
    (file) => !allowedTypes.includes(file.type)
  );

  if (invalidFile) {
    setError(
      `"${invalidFile.name}" is not a supported audio file.`
    );
    return;
  }

  const tooLarge = files.find(
    (file) => file.size > 100 * 1024 * 1024
  );

  if (tooLarge) {
    setError(
      `"${tooLarge.name}" is larger than 100MB.`
    );
    return;
  }

  setError("");
  setSuccess("");
  setAudioFiles(files);
}


 useEffect(() => {
  loadPerson();
  loadAudioFiles();
}, [personId]);

  async function loadPerson() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("people")
      .select("*")
      .eq("id", personId)
      .single();

    if (error) {
      console.error(error);
      setError(error.message);
      setLoading(false);
      return;
    }

    setPerson(data);
    setName(data.name);
    setDescription(data.description || "");

    if (data.image_path) {
      await loadImage(data.image_path);
    }

    setLoading(false);
  }

  async function loadAudioFiles() {
  setLoadingAudio(true);

  const { data, error } = await supabase
    .from("audio_files")
    .select("*")
    .eq("person_id", personId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    setError(error.message);
    setLoadingAudio(false);
    return;
  }

  setUploadedAudioFiles(data || []);
  setLoadingAudio(false);
}

async function handlePlayAudio(audio: AudioFile) {
  setError("");

  const { data, error } = await supabase.storage
    .from("private-media")
    .createSignedUrl(audio.file_path, 60 * 60);

  if (error) {
    console.error(error);
    setError(error.message);
    return;
  }

  const audioElement = new Audio(data.signedUrl);

  setPlayingAudioId(audio.id);

  audioElement.onended = () => {
    setPlayingAudioId(null);
  };

  audioElement.onerror = () => {
    setPlayingAudioId(null);
    setError("Unable to play this audio file.");
  };

  await audioElement.play();
}

  async function getAudioUrl(audio: AudioFile) {
  if (audioUrls[audio.id]) {
    return audioUrls[audio.id];
  }

  const { data, error } = await supabase.storage
    .from("private-media")
    .createSignedUrl(audio.file_path, 60 * 60);

  if (error) {
    console.error(error);
    setError(error.message);
    return null;
  }

  setAudioUrls((current) => ({
    ...current,
    [audio.id]: data.signedUrl,
  }));

  return data.signedUrl;
}

  async function loadImage(path: string) {
    const { data, error } = await supabase.storage
      .from("private-media")
      .createSignedUrl(path, 60 * 60);

    if (error) {
      console.error(error);
      return;
    }

    setImageUrl(data.signedUrl);
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5MB.");
      return;
    }

    setError("");
    setSuccess("");
    setImageFile(file);

    const previewUrl = URL.createObjectURL(file);
    setImageUrl(previewUrl);
  }

  async function uploadImage(): Promise<string | null> {
    if (!imageFile) {
      return person?.image_path || null;
    }

    setUploading(true);

    const extension =
      imageFile.name.split(".").pop()?.toLowerCase() || "jpg";

    const filePath = `people/${personId}/profile.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("private-media")
      .upload(filePath, imageFile, {
        upsert: true,
        contentType: imageFile.type,
      });

    setUploading(false);

    if (uploadError) {
      console.error(uploadError);
      setError(uploadError.message);
      return null;
    }

    return filePath;
  }

  async function uploadAudioFiles() {
  if (audioFiles.length === 0) {
    return;
  }

  setUploadingAudio(true);
  setError("");

  try {
    for (const file of audioFiles) {
      const safeName = file.name
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9._-]/g, "");

      const filePath =
        `people/${personId}/audio/` +
        `${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("private-media")
        .upload(filePath, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { error: databaseError } = await supabase
        .from("audio_files")
        .insert({
          person_id: personId,
          title: file.name,
          description: null,
          file_path: filePath,
        });

      if (databaseError) {
        // Remove the uploaded file if database insert fails.
        await supabase.storage
          .from("private-media")
          .remove([filePath]);

        throw databaseError;
      }
    }

    setAudioFiles([]);
    setSuccess(
      `${audioFiles.length} audio file(s) uploaded successfully.`
    );
  } catch (error) {
    console.error(error);

    setError(
      error instanceof Error
        ? error.message
        : "Failed to upload audio files."
    );
  } finally {
    setUploadingAudio(false);
  }
}

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    let imagePath = person?.image_path || null;

    if (imageFile) {
      const uploadedPath = await uploadImage();

      if (!uploadedPath) {
        setSaving(false);
        return;
      }

      imagePath = uploadedPath;
    }

    const { error } = await supabase
      .from("people")
      .update({
        name,
        description: description || null,
        image_path: imagePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", personId);

    if (error) {
      console.error(error);
      setError(error.message);
      setSaving(false);
      return;
    }

    setPerson((current) =>
      current
        ? {
            ...current,
            name,
            description: description || null,
            image_path: imagePath,
          }
        : current
    );

    setImageFile(null);
    setSuccess("Person updated successfully.");

    if (imagePath) {
      await loadImage(imagePath);
    }

    setSaving(false);
  }

  async function handleDeleteImage() {
    if (!person?.image_path) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to remove this profile image?"
    );

    if (!confirmed) {
      return;
    }

    setDeletingImage(true);
    setError("");
    setSuccess("");

    const { error: storageError } = await supabase.storage
      .from("private-media")
      .remove([person.image_path]);

    if (storageError) {
      console.error(storageError);
      setError(storageError.message);
      setDeletingImage(false);
      return;
    }

    const { error: databaseError } = await supabase
      .from("people")
      .update({
        image_path: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", personId);

    if (databaseError) {
      console.error(databaseError);
      setError(databaseError.message);
      setDeletingImage(false);
      return;
    }

    setPerson({
      ...person,
      image_path: null,
    });

    setImageUrl(null);
    setImageFile(null);
    setSuccess("Profile image removed.");

    setDeletingImage(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </main>
    );
  }

  if (!person) {
    return (
      <main className="p-8">
        <p className="text-red-600">{error || "Person not found."}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-dark p-8">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-6 text-sm text-gray-600 hover:text-gray-400"
        >
          ← Back to dashboard
        </button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold">Manage Person</h1>

          <p className="mt-2 text-gray-600">
            Manage {person.name}&apos;s profile.
          </p>
        </div>

        <form
          onSubmit={handleSave}
          className="space-y-6"
        >
          {/* Profile image */}
          <section className="rounded-xl border p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">
              Profile Image
            </h2>

            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={person.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm text-gray-400">
                    No image
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium">
                    Choose image
                  </span>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="block w-full text-sm border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>

                <p className="text-xs text-gray-500">
                  Maximum size: 5MB.
                </p>

                {person.image_path && (
                  <button
                    type="button"
                    onClick={handleDeleteImage}
                    disabled={deletingImage}
                    className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    {deletingImage
                      ? "Removing..."
                      : "Remove image"}
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Details */}
          <section className="rounded-xl border p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">
              Person Details
            </h2>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  required
                  className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  rows={8}
                  className="w-full resize-none rounded-lg border px-4 py-3 outline-none focus:ring-2"
                  placeholder="Write a description..."
                />
              </div>
            </div>
          </section>

          {/* Audio Files */}
          <section className="rounded-xl border p-6 shadow">
  <h2 className="mb-2 text-xl font-semibold">
    Audio Files
  </h2>

  <p className="mb-4 text-sm text-gray-500">
    Select one or multiple audio files to upload.
  </p>

  <input
    type="file"
    accept="audio/*"
    multiple
    onChange={handleAudioChange}
    className="block w-full text-sm"
  />

  {audioFiles.length > 0 && (
    <div className="mt-4">
      <p className="mb-2 text-sm font-medium">
        Selected files:
      </p>

      <ul className="space-y-2">
  {audioFiles.map((file, index) => (
    <li
      key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
      className="rounded-lg bg-gray-50 px-4 py-3 text-sm"
    >
      <div className="font-medium">
        {file.name}
      </div>

      <div className="text-xs text-gray-500">
        {(file.size / (1024 * 1024)).toFixed(2)} MB
      </div>
    </li>
  ))}
</ul>
      

      <button
        type="button"
        onClick={uploadAudioFiles}
        disabled={uploadingAudio}
        className="mt-4 rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
      >
        {uploadingAudio
          ? "Uploading..."
          : `Upload ${audioFiles.length} Audio File${
              audioFiles.length === 1 ? "" : "s"
            }`}
      </button>
    </div>
  )}
</section>
      {loadingAudio ? (
  <p className="mt-6 text-sm text-gray-500">
    Loading audio files...
  </p>
) : uploadedAudioFiles.length === 0 ? (
  <p className="mt-6 text-sm text-gray-500">
    No audio files uploaded yet.
  </p>
) : (
  <div className="mt-6 space-y-3">
    <h3 className="text-sm font-semibold">
      Uploaded Audio Files
    </h3>

    {uploadedAudioFiles.map((audio) => (
        <div 
          className="mt-4"
          key={audio.id}>
        {audioUrls[audio.id] ? (
          <audio
            controls
            className="w-full"
            src={audioUrls[audio.id]}
          />
        ) : (
          <button
            type="button"
            onClick={() => getAudioUrl(audio)}
            className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
          >
            ▶ Load & Play
          </button>
        )}
    </div>
    ))}
  </div>
)}


          {/* Messages */}
          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700">
              {success}
            </div>
          )}

          {/* Save */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || uploading}
              className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : uploading
                  ? "Uploading..."
                  : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}