"use client";

import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

type ProfileFormProps = {
  displayName: string;
  email: string;
  studentId: string;
  bio: string;
  avatarData: string;
};

const field = "mt-2 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600";

export default function ProfileForm(profile: ProfileFormProps) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(profile.avatarData);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!preview.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setRemoveAvatar(false);
    setMessage("");
    setError("");
  }

  function clearPhoto() {
    if (fileInput.current) fileInput.current.value = "";
    setPreview("");
    setRemoveAvatar(true);
    setMessage("");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    const body = new FormData(event.currentTarget);
    body.set("removeAvatar", String(removeAvatar));

    try {
      const response = await fetch("/api/profile", { method: "PUT", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not save your profile");
      setMessage("Profile saved.");
      setRemoveAvatar(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const initials = profile.displayName.trim().slice(0, 1).toUpperCase() || profile.email.slice(0, 1).toUpperCase();

  return (
    <form onSubmit={saveProfile} className="space-y-9">
      <section className="grid gap-4 border-b border-slate-200 pb-8 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-8">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Profile photo</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Optional. Use a clear square image.</p>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          {preview ? (
            <img src={preview} alt={`Profile photo for ${profile.displayName || profile.email}`} className="h-24 w-24 rounded-full border border-slate-200 object-cover" />
          ) : (
            <span aria-hidden="true" className="grid h-24 w-24 place-items-center rounded-full bg-blue-100 text-2xl font-semibold text-blue-800">{initials}</span>
          )}
          <div className="space-y-2">
            <label className="inline-flex min-h-10 cursor-pointer items-center border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-within:outline focus-within:outline-2 focus-within:outline-blue-600">
              Choose photo
              <input ref={fileInput} name="avatar" type="file" accept="image/png,image/jpeg,image/webp" onChange={choosePhoto} className="sr-only" />
            </label>
            {profile.avatarData && preview && (
              <button type="button" onClick={clearPhoto} className="ml-3 min-h-10 px-2 text-sm font-medium text-rose-700 hover:text-rose-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
                Remove photo
              </button>
            )}
            <p className="text-xs text-slate-500">PNG, JPG, or WebP. Maximum 2 MB.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 border-b border-slate-200 pb-8 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-8">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Personal details</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Information shown with your course activity.</p>
        </div>
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Full name
            <input name="displayName" required maxLength={80} defaultValue={profile.displayName} autoComplete="name" className={field} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Email address
            <input value={profile.email} readOnly className={`${field} bg-slate-50 text-slate-500`} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Student ID
            <input value={profile.studentId} readOnly aria-describedby="student-id-help" className={`${field} bg-slate-50 text-slate-600`} />
            <span id="student-id-help" className="mt-1 block text-xs font-normal leading-5 text-slate-500">Assigned to your account at signup. Share it with an administrator when they need to find your learning activity.</span>
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            About you <span className="font-normal text-slate-500">(optional)</span>
            <textarea name="bio" rows={4} maxLength={500} defaultValue={profile.bio} className={`${field} min-h-28 resize-y`} />
          </label>
        </div>
      </section>

      {error && <p role="alert" className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {message && <p role="status" className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
      <div className="flex items-center justify-end gap-4">
        <button type="submit" disabled={busy} className="min-h-11 border border-blue-700 bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
          {busy ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}