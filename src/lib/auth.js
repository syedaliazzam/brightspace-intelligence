import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export const roleToDashboard = {
  admin: "/admin/dashboard",
  coordinator: "/coordinator/dashboard",
  teacher: "/teacher/dashboard",
  parent: "/parent/dashboard",
  student: "/student/dashboard",
};

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIdentifier(value) {
  const trimmed = clean(value);
  if (trimmed.includes("@")) {
    return trimmed.toLowerCase();
  }

  return trimmed.replace(/\s+/g, "").replace(/[-()]/g, "");
}

function toAuthError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        identifier: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
  const rawIdentifier = clean(credentials?.identifier);
  const password = typeof credentials?.password === "string" ? credentials.password : "";

  if (!rawIdentifier) {
    throw toAuthError("missing_identifier");
  }

  if (!password.trim()) {
    throw toAuthError("missing_password");
  }

  const isEmail = rawIdentifier.includes("@");
  const phoneIdentifier = rawIdentifier.replace(/\D/g, "");

  // Only allow email OR valid phone.
  // Do not search phone when phoneIdentifier is empty.
  let whereCondition;

  if (isEmail) {
    whereCondition = Prisma.sql`
      LOWER(TRIM(COALESCE(u.email, ''))) = LOWER(TRIM(${rawIdentifier}))
    `;
  } else if (phoneIdentifier.length >= 7) {
    whereCondition = Prisma.sql`
      REGEXP_REPLACE(COALESCE(u.phone, ''), '\\D', '', 'g') = ${phoneIdentifier}
    `;
  } else {
    // Blocks wrong input like "admin", "teacher", "parent"
    return null;
  }

  const users = await prisma.$queryRaw(
    Prisma.sql`
      SELECT
        u.id::text AS id,
        u.email,
        u.phone,
        u.password_hash,
        u.status::text AS status,
        r.name AS role_name
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE ${whereCondition}
    `
  );

  const user = users?.[0];

  if (!user) {
    return null;
  }

  if (String(user.status || "").toLowerCase() !== "active") {
    return null;
  }

  if (!user.password_hash) {
    return null;
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    return null;
  }

  const role = String(user.role_name || "").trim().toLowerCase();

  if (!roleToDashboard[role]) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role,
    status: user.status,
  };
},
    }),
  ],
  callbacks: {
async jwt({ token, user }) {
  if (user) {
    token.userId = user.id;
    token.email = user.email || "";
    token.role = user.role;
    token.status = user.status;
    token.phone = user.phone || "";
  }

  return token;
},
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId;
        session.user.email = token.email;
        session.user.role = token.role;
        session.user.status = token.status;
        session.user.phone = token.phone;
      }

      return session;
    },
  },
});
