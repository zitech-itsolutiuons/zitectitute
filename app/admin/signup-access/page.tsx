import SignupCodeManager from "@/components/admin/SignupCodeManager";
import { connectDB } from "@/lib/db";
import { PlatformSettings } from "@/lib/models/PlatformSettings";
import { SignupCode } from "@/lib/models/SignupCode";
import { User } from "@/lib/models/User";
import { decryptSignupCode } from "@/lib/signupCodes";

export const dynamic = "force-dynamic";

export default async function AdminSignupAccessPage() {
  await connectDB();
  const [settings, signupCodes] = await Promise.all([
    PlatformSettings.findOne({ key: "platform" }).select("requireSignupCode").lean(),
    SignupCode.find().sort({ createdAt: -1 }).select("encryptedCode active createdAt").lean(),
  ]);
  const signupCodeUsers = signupCodes.length
    ? await User.find({ signupCodeId: { $in: signupCodes.map((code) => code._id) } })
        .sort({ createdAt: -1 })
        .select("name email signupCodeId createdAt")
        .lean()
    : [];
  const signupUsersByCode = new Map<string, typeof signupCodeUsers>();
  for (const user of signupCodeUsers) {
    const codeId = String(user.signupCodeId);
    signupUsersByCode.set(codeId, [...(signupUsersByCode.get(codeId) ?? []), user]);
  }

  return (
    <SignupCodeManager
      requireSignupCode={settings?.requireSignupCode ?? true}
      codes={signupCodes.map((code) => ({
        id: String(code._id),
        code: decryptSignupCode(code.encryptedCode),
        active: code.active,
        createdAt: code.createdAt.toISOString(),
        users: (signupUsersByCode.get(String(code._id)) ?? []).map((user) => ({
          id: String(user._id),
          name: user.name,
          email: user.email,
          createdAt: user.createdAt.toISOString(),
        })),
      }))}
    />
  );
}