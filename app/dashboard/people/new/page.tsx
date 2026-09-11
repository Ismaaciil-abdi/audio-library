"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewPersonPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function createSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    const slug = createSlug(name);

    if (!slug) {
      setError("Please enter a valid name.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("people")
      .insert({
        name,
        slug,
        description: description || null,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(`/dashboard/people/${data.id}`);
  }

  return (
    <main className="min-h-screen bg-dark-800s p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-gray-600 hover:text-gray-400"
          >
            ← Back to dashboard
          </button>

          <h1 className="mt-4 text-3xl font-bold">Add Person</h1>

          <p className="mt-2 text-gray-400">
            Create a new person profile.
          </p>
        </div>

        <div className="rounded-xl bg-dark p-6 shadow">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Name
              </label>

              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                placeholder="Ahmed Ali"
                className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
              />

              {name && (
                <p className="mt-2 text-xs text-gray-500">
                  URL: /p/{createSlug(name)}
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Description
              </label>

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={6}
                placeholder="Write a description about this person..."
                className="w-full resize-none rounded-lg border px-4 py-3 outline-none focus:ring-2"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-white px-6 py-3 text-black disabled:opacity-50 hover:opacity-80"
              >
                {loading ? "Creating..." : "Create Person"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}