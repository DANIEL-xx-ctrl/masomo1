-- ============================================
--   MASOMO - Export Base de Données
--   Date: 2026-05-29T08:35:07.047Z
--   Source: /home/z/my-project/db/custom.db
--   Total: 31 enregistrements
-- ============================================

PRAGMA foreign_keys = OFF;

-- ─── Table: Class (4 enregistrements) ───
DROP TABLE IF EXISTS "Class";
CREATE TABLE "Class" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "section" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 30,
    "schoolYear" TEXT NOT NULL DEFAULT '2024-2025',
    "room" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "Class" ("id", "name", "level", "section", "capacity", "schoolYear", "room", "createdAt", "updatedAt") VALUES ('cmppda6gq000nkn0vy3vmxsun', '6ème A', '6ème', 'A', 35, '2024-2025', 'Salle 101', 1779965132858, 1779965132858);
INSERT INTO "Class" ("id", "name", "level", "section", "capacity", "schoolYear", "room", "createdAt", "updatedAt") VALUES ('cmppda6gr000okn0vpz7xobk2', '5ème B', '5ème', 'B', 30, '2024-2025', 'Salle 202', 1779965132860, 1779965132860);
INSERT INTO "Class" ("id", "name", "level", "section", "capacity", "schoolYear", "room", "createdAt", "updatedAt") VALUES ('cmppda6gs000pkn0voqt07ff4', '4ème C', '4ème', 'C', 28, '2024-2025', 'Salle 303', 1779965132861, 1779965132861);
INSERT INTO "Class" ("id", "name", "level", "section", "capacity", "schoolYear", "room", "createdAt", "updatedAt") VALUES ('cmppda6gt000qkn0v5xs2g747', 'Terminale D', 'Terminale', 'D', 25, '2024-2025', 'Salle 404', 1779965132862, 1779965132862);

-- ─── Table: Student (21 enregistrements) ───
DROP TABLE IF EXISTS "Student";
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TEXT,
    "gender" TEXT,
    "address" TEXT,
    "enrollmentDate" TEXT NOT NULL DEFAULT '2024-01-01',
    "parentContact" TEXT,
    "classId" TEXT,
    "parentPhone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "image" TEXT,
    CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

INSERT INTO "Student" ("id", "userId", "firstName", "lastName", "dateOfBirth", "gender", "address", "enrollmentDate", "parentContact", "classId", "parentPhone", "createdAt", "updatedAt", "image") VALUES ('cmppda6hh001xkn0v7cqhgsz7', 'cmppda6hg001vkn0vawbtsx0f', 'Moussa', 'Keita', '2012-03-15', 'M', 'Douala, Cameroun', '2024-09-01', 'Mariam Keita', 'cmppda6gq000nkn0vy3vmxsun', '+237 611 100 001', 1779965132886, 1779965132886, '/avatars/boy-1.png');
INSERT INTO "Student" ("id", "userId", "firstName", "lastName", "dateOfBirth", "gender", "address", "enrollmentDate", "parentContact", "classId", "parentPhone", "createdAt", "updatedAt", "image") VALUES ('cmppda6hk0020kn0vn1gii98g', 'cmppda6hi001ykn0vo4zsffkg', 'Adama', 'Traoré', '2012-05-22', 'M', 'Douala, Cameroun', '2024-09-01', 'Oumou Traoré', 'cmppda6gq000nkn0vy3vmxsun', '+237 611 100 002', 1779965132888, 1779965132888, '/avatars/boy-2.png');
INSERT INTO "Student" ("id", "userId", "firstName", "lastName", "dateOfBirth", "gender", "address", "enrollmentDate", "parentContact", "classId", "parentPhone", "createdAt", "updatedAt", "image") VALUES ('cmppda6hm0023kn0vhe0ukzud', 'cmppda6hl0021kn0vd5e3auyw', 'Aminata', 'Diarra', '2012-07-10', 'F', 'Douala, Cameroun', '2024-09-01', 'Seydou Diarra', 'cmppda6gq000nkn0vy3vmxsun', '+237 611 100 003', 1779965132891, 1779965132891, '/avatars/girl-1.png');
INSERT INTO "Student" ("id", "userId", "firstName", "lastName", "dateOfBirth", "gender", "address", "enrollmentDate", "parentContact", "classId", "parentPhone", "createdAt", "updatedAt", "image") VALUES ('cmppda6hp0026kn0vf67wsq6o', 'cmppda6ho0024kn0v04gnojca', 'Ibrahim', 'Sow', '2012-01-30', 'M', 'Douala, Cameroun', '2024-09-01', 'Aissatou Sow', 'cmppda6gq000nkn0vy3vmxsun', '+237 611 100 004', 1779965132893, 1779965132893, '/avatars/boy-3.png');
INSERT INTO "Student" ("id", "userId", "firstName", "lastName", "dateOfBirth", "gender", "address", "enrollmentDate", "parentContact", "classId", "parentPhone", "createdAt", "updatedAt", "image") VALUES ('cmppda6hr0029kn0vxajvwb1r', 'cmppda6hq0027kn0v8q9cq77b', 'Fatoumata', 'Camara', '2012-09-05', 'F', 'Douala, Cameroun', '2024-09-01', 'Lamine Camara', 'cmppda6gq000nkn0vy3vmxsun', '+237 611 100 005', 1779965132895, 1779965132895, '/avatars/girl-2.png');
INSERT INTO "Student" ("id", "userId", "firstName", "lastName", "dateOfBirth", "gender", "address", "enrollmentDate", "parentContact", "classId", "parentPhone", "createdAt", "updatedAt", "image") VALUES ('cmppda6hu002ckn0vsrzst1m8', 'cmppda6ht002akn0vdc7xiif6', 'Ousmane', 'Barry', '2012-11-18', 'M', 'Douala, Cameroun', '2024-09-01', 'Kadiatou Barry', 'cmppda6gq000nkn0vy3vmxsun', '+237 611 100 006', 1779965132898, 1779965132898, '/avatars/boy-4.png');
INSERT INTO "Student" ("id", "userId", "firstName", "lastName", "dateOfBirth", "gender", "address", "enrollmentDate", "parentContact", "classId", "parentPhone", "createdAt", "updatedAt", "image") VALUES ('cmppda6hw002fkn0vcqynoh6q', 'cmppda6hv002dkn0v6j8knvx3', 'Aïssatou', 'Bah', '2011-04-12', 'F', 'Douala, Cameroun', '2024-09-01', 'Thierno Bah', 'cmppda6gr000okn0vpz7xobk2', '+237 622 200 001', 1779965132900, 1779965132900, '/avatars/girl-3.png');
INSERT INTO "Student" ("id", "userId", "firstName", "lastName", "dateOfBirth", "gender", "address", "enrollmentDate", "parentContact", "classId", "parentPhone", "createdAt", "updatedAt", "image") VALUES ('cmppda6hy002ikn0v2xf7aiek', 'cmppda6hx002gkn0vxgwpi96v', 'Cheikh', 'Sylla', '2011-06-25', 'M', 'Douala, Cameroun', '2024-09-01', 'Mariama Sylla', 'cmppda6gr000okn0vpz7xobk2', '+237 622 200 002', 1779965132903, 1779965132903, '/avatars/boy-5.png');
INSERT INTO "Student" ("id", "userId", "firstName", "lastName", "dateOfBirth", "gender", "address", "enrollmentDate", "parentContact", "classId", "parentPhone", "createdAt", "updatedAt", "image") VALUES ('cmppda6i0002lkn0v15xzi65r', 'cmppda6hz002jkn0vc252a954', 'Kadiatou', 'Koné', '2011-08-03', 'F', 'Douala, Cameroun', '2024-09-01', 'Bakary Koné', 'cmppda6gr000okn0vpz7xobk2', '+237 622 200 003', 1779965132905, 1779965132905, '/avatars/girl-4.png');
INSERT INTO "Student" ("id", "userId", "firstName", "lastName", "dateOfBirth", "gender", "address", "enrollmentDate", "parentContact", "classId", "parentPhone", "createdAt", "updatedAt", "image") VALUES ('cmppda6i3002okn0vp32u39bo', 'cmppda6i2002mkn0vciv7msyv', 'Boubacar', 'Cissé', '2011-02-14', 'M', 'Douala, Cameroun', '2024-09-01', 'Fatoumata Cissé', 'cmppda6gr000okn0vpz7xobk2', '+237 622 200 004', 1779965132907, 1779965132907, '/avatars/boy-6.png');
INSERT INTO "Student" ("id", "userId", "firstName", "lastName", "dateOfBirth", "gender", "address", "enrollmentDate", "parentContact", "classId", "parentPhone", "createdAt", "updatedAt", "image") VALUES ('cmppda6i5002rkn0vam9t5e8g', 'cmppda6i4002pkn0vbor4v7fs', 'Mariam', 'Sangaré', '2011-12-01', 'F', 'Douala, Cameroun', '2024-09-01', 'Sékou Sangaré', 'cmppda6gr000okn0vpz7xobk2', '+237 622 200 005', 1779965132909, 1779965132909, '/avatars/girl-5.png');
INSERT INTO "Student" ("id", "userId", "firstName", "lastName", "dateOfBirth", "gender", "address", "enrollmentDate", "parentContact", "classId", "parentPhone", "createdAt", "updatedAt", "image") VALUES ('cmppda6i7002ukn0v5nz03dnx', 'cmppda6i6002skn0vr42jkzow', 'Seydou', 'Coulibaly', '2010-07-20', 'M', 'Douala, Cameroun', '2024-09-01', 'Ami Coulibaly', 'cmppda6gs000pkn0voqt07ff4', '+237 633 300 001', 1779965132911, 1779965132911, '/avatars/boy-7.png');
INSERT INTO "Student" ("id", "userId", "firstName", "lastName", "dateOfBirth", "gender", "address", "enrollmentDate", "parentContact", "classId", "parentPhone", "createdAt", "updatedAt", "image") VALUES ('cmppda6i9002xkn0vbv1db429', 'cmppda6i8002vkn0vyhcd4nzy', 'Oumou', 'Kanouté', '2010-09-15', 'F', 'Douala, Cameroun', '2024-09-01', 'Mamadou Kanouté', 'cmppda6gs000pkn0voqt07ff4', '+237 633 300 002', 1779965132914, 1779965132914, '/avatars/girl-6.png');
INSERT INTO "Student" ("id", "userId", "firstName", "lastName", "dateOfBirth", "gender", "address", "enrollmentDate", "parentContact", "classId", "parentPhone", "createdAt", "updatedAt", "image") VALUES ('cmppda6ib0030kn0v9a3ejq9r', 'cmppda6ia002ykn0vsnaxj4yk', 'Modibo', 'Dembélé', '2010-03-08', 'M', 'Douala, Cameroun', '2024-09-01', 'Hawa Dembélé', 'cmppda6gs000pkn0voqt07ff4', '+237 633 300 003', 1779965132916, 1779965132916, '/avatars/boy-8.png');
INSERT INTO "Student" ("id", "userId", "firstName", "lastName", "dateOfBirth", "gender", "address", "enrollmentDate", "parentContact", "classId", "parentPhone", "createdAt", "updatedAt", "image") VALUES ('cmppda6id0033kn0vq76b1jxc', 'cmppda6ic0031kn0vrzoih1gg', 'Djénéba', 'Maïga', '2010-05-30', 'F', 'Douala, Cameroun', '2024-09-01', 'Abdoulaye Maïga', 'cmppda6gs000pkn0voqt07ff4', '+237 633 300 004', 1779965132918, 1779965132918, '/avatars/girl-7.png');
INSERT INTO "Student" ("id", "userId", "firstName", "lastName", "dateOfBirth", "gender", "address", "enrollmentDate", "parentContact", "classId", "parentPhone", "createdAt", "updatedAt", "image") VALUES ('cmppda6ig0036kn0vm4xh2cux', 'cmppda6if0034kn0va2nh3fom', 'Abdou', 'Haidara', '2010-01-22', 'M', 'Douala, Cameroun', '2024-09-01', 'Zeinabou Haidara', 'cmppda6gs000pkn0voqt07ff4', '+237 633 300 005', 1779965132920, 1779965132920, '/avatars/boy-1.png');
INSERT INTO "Student" ("id", "userId", "firstName", "lastName", "dateOfBirth", "gender", "address", "enrollmentDate", "parentContact", "classId", "parentPhone", "createdAt", "updatedAt", "image") VALUES ('cmppda6ii0039kn0viuqa2iyq', 'cmppda6ih0037kn0v67oxh9rk', 'Alassane', 'Ouattara', '2007-10-05', 'M', 'Douala, Cameroun', '2024-09-01', 'Awa Ouattara', 'cmppda6gt000qkn0v5xs2g747', '+237 644 400 001', 1779965132922, 1779965132922, '/avatars/boy-2.png');
INSERT INTO "Student" ("id", "userId", "firstName", "lastName", "dateOfBirth", "gender", "address", "enrollmentDate", "parentContact", "classId", "parentPhone", "createdAt", "updatedAt", "image") VALUES ('cmppda6ik003ckn0vxxls5dpz', 'cmppda6ij003akn0vpgxq91j5', 'Aminata', 'Fofana', '2007-06-18', 'F', 'Douala, Cameroun', '2024-09-01', 'Moussa Fofana', 'cmppda6gt000qkn0v5xs2g747', '+237 644 400 002', 1779965132925, 1779965132925, '/avatars/girl-8.png');
INSERT INTO "Student" ("id", "userId", "firstName", "lastName", "dateOfBirth", "gender", "address", "enrollmentDate", "parentContact", "classId", "parentPhone", "createdAt", "updatedAt", "image") VALUES ('cmppda6im003fkn0v605qlsbl', 'cmppda6il003dkn0v4tds9v0f', 'Ibrahima', 'Touré', '2007-08-25', 'M', 'Douala, Cameroun', '2024-09-01', 'Assétou Touré', 'cmppda6gt000qkn0v5xs2g747', '+237 644 400 003', 1779965132927, 1779965132927, '/avatars/boy-3.png');
INSERT INTO "Student" ("id", "userId", "firstName", "lastName", "dateOfBirth", "gender", "address", "enrollmentDate", "parentContact", "classId", "parentPhone", "createdAt", "updatedAt", "image") VALUES ('cmppda6io003ikn0v10ec1c8b', 'cmppda6in003gkn0vi7jruvuf', 'Sitan', 'Keita', '2007-04-12', 'F', 'Douala, Cameroun', '2024-09-01', 'Boubacar Keita', 'cmppda6gt000qkn0v5xs2g747', '+237 644 400 004', 1779965132929, 1779965132929, '/avatars/girl-1.png');
INSERT INTO "Student" ("id", "userId", "firstName", "lastName", "dateOfBirth", "gender", "address", "enrollmentDate", "parentContact", "classId", "parentPhone", "createdAt", "updatedAt", "image") VALUES ('cmpqkf8890005jrln06cbvs29', 'cmpqkf8870003jrlnf5nrr8bk', 'Élève', 'Démo', '2010-05-15', 'M', 'Douala, Cameroun', '2024-09-01', 'Parent Démo', 'cmppda6gq000nkn0vy3vmxsun', '+237 699 888 888', 1780037591913, 1780037591913, '/avatars/boy-1.png');

-- ─── Table: Teacher (6 enregistrements) ───
DROP TABLE IF EXISTS "Teacher";
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "phone" TEXT,
    "qualification" TEXT,
    "hireDate" TEXT NOT NULL DEFAULT '2024-01-01',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "image" TEXT,
    CONSTRAINT "Teacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Teacher_userId_key" ON "Teacher"("userId");

INSERT INTO "Teacher" ("id", "userId", "firstName", "lastName", "subject", "phone", "qualification", "hireDate", "createdAt", "updatedAt", "image") VALUES ('cmppda6fz000akn0vik212ynn', 'cmppda6fy0008kn0v89egr9zz', 'Amadou', 'Diallo', 'Mathématiques', '+237 691 111 111', 'Doctorat en Mathématiques', '2020-09-01', 1779965132832, 1779965132832, '/avatars/amadou-diallo.png');
INSERT INTO "Teacher" ("id", "userId", "firstName", "lastName", "subject", "phone", "qualification", "hireDate", "createdAt", "updatedAt", "image") VALUES ('cmppda6gj000dkn0vywt5jfqt', 'cmppda6g1000bkn0vd9mlgqtg', 'Fatou', 'Ndiaye', 'Français', '+237 692 222 222', 'Maîtrise en Lettres Modernes', '2020-09-01', 1779965132851, 1779965132851, '/avatars/fatou-ndiaye.png');
INSERT INTO "Teacher" ("id", "userId", "firstName", "lastName", "subject", "phone", "qualification", "hireDate", "createdAt", "updatedAt", "image") VALUES ('cmppda6gl000gkn0v7idt2beb', 'cmppda6gk000ekn0v8dcz2pm5', 'Emmanuel', 'Biya', 'Anglais', '+237 693 333 333', 'Master en Anglais', '2020-09-01', 1779965132854, 1779965132854, '/avatars/emmanuel-biya.png');
INSERT INTO "Teacher" ("id", "userId", "firstName", "lastName", "subject", "phone", "qualification", "hireDate", "createdAt", "updatedAt", "image") VALUES ('cmppda6gn000jkn0vr1hhwynh', 'cmppda6gm000hkn0vbp1p6fea', 'Aïcha', 'Toure', 'Histoire-Géo', '+237 694 444 444', 'Licence en Histoire', '2020-09-01', 1779965132856, 1779965132856, '/avatars/aicha-toure.png');
INSERT INTO "Teacher" ("id", "userId", "firstName", "lastName", "subject", "phone", "qualification", "hireDate", "createdAt", "updatedAt", "image") VALUES ('cmppda6gp000mkn0vp2i8lzaa', 'cmppda6go000kkn0v91yqsjd1', 'Kouadio', 'Yao', 'SVT', '+237 695 555 555', 'Master en Biologie', '2020-09-01', 1779965132858, 1779965132858, '/avatars/kouadio-yao.png');
INSERT INTO "Teacher" ("id", "userId", "firstName", "lastName", "subject", "phone", "qualification", "hireDate", "createdAt", "updatedAt", "image") VALUES ('cmpqkf8860002jrlnd0c1yylo', 'cmpqkf8820000jrlnaqni8b3p', 'Enseignant', 'Démo', 'Mathématiques', '+237 699 999 999', 'Maîtrise', '2020-09-01', 1780037591910, 1780037591910, '/avatars/teacher-male-1.png');

PRAGMA foreign_keys = ON;
