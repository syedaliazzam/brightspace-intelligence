import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export const roleToDashboard = {
  superadmin: "/superadmin/dashboard",
  admin: "/admin/dashboard",
  coordinator: "/coordinator/dashboard",
  teacher: "/teacher/dashboard",
  parent: "/parent/dashboard",
  student: "/student/dashboard",
};

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRoleName(value) {
  return clean(value).toLowerCase();
}

function normalizeIdentifier(value) {
  const trimmed = clean(value);
  if (trimmed.includes("@")) {
    return trimmed.toLowerCase();
  }

  return trimmed.replace(/\s+/g, "").replace(/[-()]/g, "");
}

async function getUserRoleNames(userId) {
  const normalizedUserId = clean(userId);
  if (!normalizedUserId) {
    return [];
  }

  const roleNames = new Set();
  const tableCheck = await prisma.$queryRaw(
    Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'user_roles'
      ) AS has_user_roles_table
    `
  );

  const hasUserRolesTable = Boolean(tableCheck?.[0]?.has_user_roles_table);

  if (hasUserRolesTable) {
    const mappedRoles = await prisma.$queryRaw(
      Prisma.sql`
        SELECT DISTINCT LOWER(TRIM(r.name)) AS role_name
        FROM user_roles ur
        INNER JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = ${normalizedUserId}::uuid
      `
    );

    mappedRoles.forEach((role) => {
      const normalizedRole = String(role.role_name || "").trim().toLowerCase();
      if (normalizedRole) {
        roleNames.add(normalizedRole);
      }
    });
  }

  const fallbackRoles = await prisma.$queryRaw(
    Prisma.sql`
      SELECT DISTINCT LOWER(TRIM(r.name)) AS role_name
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE u.id = ${normalizedUserId}::uuid
    `
  );

  fallbackRoles.forEach((role) => {
    const normalizedRole = String(role.role_name || "").trim().toLowerCase();
    if (normalizedRole) {
      roleNames.add(normalizedRole);
    }
  });

  return Array.from(roleNames);
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
          return null;
        }

        if (!password.trim()) {
          return null;
        }

        const isEmail = rawIdentifier.includes("@");
        const phoneIdentifier = rawIdentifier.replace(/\D/g, "");
        const normalizedUsername = normalizeIdentifier(rawIdentifier).toLowerCase();

        let whereCondition;

        if (isEmail) {
          whereCondition = Prisma.sql`
            LOWER(TRIM(COALESCE(u.email, ''))) = LOWER(TRIM(${rawIdentifier}))
          `;
        } else if (phoneIdentifier.length >= 7) {
          whereCondition = Prisma.sql`
            (
              REGEXP_REPLACE(COALESCE(u.phone, ''), '\\D', '', 'g') = ${phoneIdentifier}
              OR LOWER(TRIM(COALESCE(u.username, ''))) = LOWER(TRIM(${normalizedUsername}))
            )
          `;
        } else if (normalizedUsername) {
          whereCondition = Prisma.sql`
            LOWER(TRIM(COALESCE(u.username, ''))) = LOWER(TRIM(${normalizedUsername}))
          `;
        } else {
          return null;
        }

        const users = await prisma.$queryRaw(
          Prisma.sql`
            SELECT
              u.id::text AS id,
              u.full_name,
              u.username,
              u.email,
              u.phone,
              u.password_hash,
              u.status::text AS status
            FROM users u
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

        const storedPassword = String(user.password_hash || "");
        const passwordMatches = password === storedPassword;
        if (!passwordMatches) {
          return null;
        }

        const availableRoles = await getUserRoleNames(user.id);
        const requestedRole = normalizeRoleName(credentials?.selectedRole);
        const hasRequestedRole = Boolean(requestedRole && availableRoles.includes(requestedRole));

        if (availableRoles.length > 1 && !hasRequestedRole) {
          return {
            id: user.id,
            full_name: user.full_name || "",
            name: user.full_name || "",
            username: user.username || "",
            email: user.email || "",
            phone: user.phone || "",
            role: "",
            roles: availableRoles,
            selectedRole: "",
            status: user.status,
            requiresRoleSelection: true,
          };
        }

        const resolvedRole = hasRequestedRole ? requestedRole : availableRoles[0] || "";
        if (!resolvedRole || !roleToDashboard[resolvedRole]) {
          return null;
        }

        return {
          id: user.id,
          full_name: user.full_name || "",
          name: user.full_name || "",
          username: user.username || "",
          email: user.email || "",
          phone: user.phone || "",
          role: resolvedRole,
          roles: availableRoles,
          selectedRole: resolvedRole,
          status: user.status,
          requiresRoleSelection: false,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.full_name = user.full_name || "";
        token.name = user.full_name || "";
        token.username = user.username || "";
        token.email = user.email || "";
        token.role = user.selectedRole || user.role || "";
        token.selectedRole = user.selectedRole || user.role || "";
        token.roles = Array.isArray(user.roles) ? user.roles : [];
        token.status = user.status;
        token.phone = user.phone || "";
        token.requiresRoleSelection = Boolean(user.requiresRoleSelection);
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId;
        session.user.full_name = token.full_name || "";
        session.user.name = token.name || token.full_name || "";
        session.user.username = token.username || "";
        session.user.email = token.email;
        session.user.role = token.selectedRole || token.role || "";
        session.user.selectedRole = token.selectedRole || token.role || "";
        session.user.roles = Array.isArray(token.roles) ? token.roles : [];
        session.user.status = token.status;
        session.user.phone = token.phone;
        session.user.requiresRoleSelection = Boolean(token.requiresRoleSelection);
      }

      return session;
    },
  },
});
