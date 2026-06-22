import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
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
  return trimmed.includes("@") ? trimmed.toLowerCase() : trimmed;
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
        identifier: { label: "Email or phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const identifier = normalizeIdentifier(credentials?.identifier);
        const password = typeof credentials?.password === "string" ? credentials.password : "";

        if (!identifier) {
          throw toAuthError("missing_identifier");
        }

        if (!password.trim()) {
          throw toAuthError("missing_password");
        }

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: identifier, mode: "insensitive" } },
              { phone: identifier },
            ],
          },
          select: {
            id: true,
            email: true,
            phone: true,
            password_hash: true,
            status: true,
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        if (!user) {
          return null;
        }

        if (String(user.status).toLowerCase() !== "active") {
          throw toAuthError("inactive_account");
        }

        if (!user.password_hash) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatches) {
          return null;
        }

        if (!user.role?.name) {
          throw toAuthError("invalid_role");
        }

        return {
          id: user.id,
          email: user.email,
          phone: user.phone,
          role: String(user.role?.name || "").toLowerCase(),
          status: user.status,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.email = user.email;
        token.role = user.role;
        token.status = user.status;
        token.phone = user.phone;
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
