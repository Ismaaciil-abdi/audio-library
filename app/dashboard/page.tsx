import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Person = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_path: string | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: people, error } = await supabase
    .from("people")
    .select("id, name, slug, description, image_path")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-lg bg-red-50 p-4 text-red-600">
            {error.message}
          </div>
        </div>
      </main>
    );
  }

  // Generate signed URLs for private profile images
  const peopleWithImages = await Promise.all(
    (people || []).map(async (person) => {
      let imageUrl: string | null = null;

      if (person.image_path) {
        const { data } = await supabase.storage
          .from("private-media")
          .createSignedUrl(person.image_path, 60 * 60);

        imageUrl = data?.signedUrl || null;
      }

      return {
        ...person,
        imageUrl,
      };
    })
  );

  return (
    <main className="min-h-screen bg-dark p-8">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>

            <p className="mt-2 text-gray-400">
              Manage your people and audio files.
            </p>
          </div>

          <Link
            href="/dashboard/people/new"
            className="rounded-lg bg-white px-4 py-2 text-black hover:bg-gray-800"
          >
            + Add Person
          </Link>
        </div>

        {/* People */}
        {peopleWithImages.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

            {peopleWithImages.map((person) => (
              <div
                key={person.id}
                className="overflow-hidden rounded-xl bg-dark shadow border border-gray-600"
              >

                {/* Profile Image */}
                <div className="h-48 w-full bg-gray-100">
                  {person.imageUrl ? (
                    <img
                      src={person.imageUrl}
                      alt={person.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="text-gray-400">
                        No image
                      </span>
                    </div>
                  )}
                </div>

                {/* Person Details */}
                <div className="p-5">
                  <h2 className="text-xl font-semibold">
                    {person.name}
                  </h2>

                  {person.description && (
                    <p className="mt-2 line-clamp-3 text-sm text-gray-600">
                      {person.description}
                    </p>
                  )}

                  <Link
                    href={`/dashboard/people/${person.id}`}
                    className="mt-5 block rounded-lg bg-white px-4 py-2 text-center text-sm font-medium text-black hover:opacity-80"
                  >
                    Manage
                  </Link>
                </div>

              </div>
            ))}

          </div>
        ) : (
          <div className="rounded-xl border p-10 text-center shadow">
            <h2 className="text-xl font-semibold">
              No people yet
            </h2>

            <p className="mt-2 text-gray-500">
              Add your first person to get started.
            </p>

            <Link
              href="/dashboard/people/new"
              className="mt-5 inline-block bg-white text-black rounded-lg px-5 py-3 hover:opacity-80"
            >
              Add Person
            </Link>
          </div>
        )}

      </div>
    </main>
  );
}