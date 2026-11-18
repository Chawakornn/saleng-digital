CREATE TABLE "Community" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "guide" TEXT NOT NULL,
  "active" INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE "User" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "username" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "communityId" INTEGER NOT NULL REFERENCES "Community"("id") ON DELETE RESTRICT,
  "active" INTEGER NOT NULL DEFAULT 1,
  "demo" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE "Session" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "token" TEXT NOT NULL UNIQUE,
  "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "expires" TEXT NOT NULL
);

CREATE TABLE "LoginAttempt" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "key" TEXT NOT NULL UNIQUE,
  "attempts" INTEGER NOT NULL,
  "since" TEXT NOT NULL
);

CREATE TABLE "Point" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "communityId" INTEGER NOT NULL REFERENCES "Community"("id") ON DELETE RESTRICT,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "active" INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE "Buyer" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "userId" INTEGER NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE RESTRICT,
  "shop" TEXT NOT NULL,
  "vehicle" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL,
  "area" TEXT NOT NULL,
  "approved" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE "Material" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "art" TEXT NOT NULL,
  "guide" TEXT NOT NULL,
  "active" INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE "Price" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "materialId" INTEGER NOT NULL REFERENCES "Material"("id") ON DELETE RESTRICT,
  "price" INTEGER NOT NULL,
  "updated" TEXT NOT NULL
);

CREATE TABLE "Round" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "communityId" INTEGER NOT NULL REFERENCES "Community"("id") ON DELETE RESTRICT,
  "pointId" INTEGER NOT NULL REFERENCES "Point"("id") ON DELETE RESTRICT,
  "name" TEXT NOT NULL,
  "startAt" TEXT NOT NULL,
  "endAt" TEXT NOT NULL,
  "cutoff" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL,
  "maxBookings" INTEGER NOT NULL,
  "minimum" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "buyerId" INTEGER REFERENCES "User"("id") ON DELETE RESTRICT,
  "invitedId" INTEGER REFERENCES "User"("id") ON DELETE RESTRICT,
  "reason" TEXT NOT NULL DEFAULT '',
  "created" TEXT NOT NULL
);

CREATE TABLE "Booking" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "roundId" INTEGER NOT NULL REFERENCES "Round"("id") ON DELETE RESTRICT,
  "sellerId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "code" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created" TEXT NOT NULL
);

CREATE TABLE "BookingItem" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "bookingId" INTEGER NOT NULL REFERENCES "Booking"("id") ON DELETE RESTRICT,
  "materialId" INTEGER NOT NULL REFERENCES "Material"("id") ON DELETE RESTRICT,
  "grams" INTEGER NOT NULL,
  "price" INTEGER NOT NULL,
  UNIQUE (bookingId, materialId)
);

CREATE TABLE "Event" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "bookingId" INTEGER NOT NULL REFERENCES "Booking"("id") ON DELETE RESTRICT,
  "actorId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "status" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "at" TEXT NOT NULL
);

CREATE TABLE "Revision" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "bookingId" INTEGER NOT NULL REFERENCES "Booking"("id") ON DELETE RESTRICT,
  "actorId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "number" INTEGER NOT NULL,
  "total" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "at" TEXT NOT NULL,
  UNIQUE (bookingId, number)
);

CREATE TABLE "WeighItem" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "revisionId" INTEGER NOT NULL REFERENCES "Revision"("id") ON DELETE RESTRICT,
  "materialId" INTEGER NOT NULL REFERENCES "Material"("id") ON DELETE RESTRICT,
  "grams" INTEGER NOT NULL,
  "price" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  UNIQUE (revisionId, materialId)
);

CREATE TABLE "Acceptance" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "revisionId" INTEGER NOT NULL UNIQUE REFERENCES "Revision"("id") ON DELETE RESTRICT,
  "sellerId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "at" TEXT NOT NULL,
  "revoked" TEXT
);

CREATE TABLE "Payment" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "bookingId" INTEGER NOT NULL UNIQUE REFERENCES "Booking"("id") ON DELETE RESTRICT,
  "revisionId" INTEGER NOT NULL UNIQUE REFERENCES "Revision"("id") ON DELETE RESTRICT,
  "amount" INTEGER NOT NULL,
  "method" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "paidAt" TEXT NOT NULL,
  "actorId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "recorded" TEXT NOT NULL
);

CREATE TABLE "Receipt" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "paymentId" INTEGER NOT NULL UNIQUE REFERENCES "Payment"("id") ON DELETE RESTRICT,
  "sellerId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "at" TEXT NOT NULL
);

CREATE TABLE "Dispute" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "bookingId" INTEGER NOT NULL REFERENCES "Booking"("id") ON DELETE RESTRICT,
  "openerId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "prior" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "resolution" TEXT,
  "handlerId" INTEGER REFERENCES "User"("id") ON DELETE RESTRICT,
  "opened" TEXT NOT NULL,
  "closed" TEXT
);

CREATE TABLE "Notice" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "message" TEXT NOT NULL,
  "at" TEXT NOT NULL,
  "seen" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE "Agreement" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "roundId" INTEGER NOT NULL REFERENCES "Round"("id") ON DELETE RESTRICT,
  "payer" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "triggerText" TEXT NOT NULL,
  UNIQUE (roundId, payer)
);

CREATE TABLE "Charge" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "agreementId" INTEGER NOT NULL UNIQUE REFERENCES "Agreement"("id") ON DELETE RESTRICT,
  "issued" TEXT NOT NULL,
  "paid" TEXT
);

CREATE TABLE "Economics" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "roundId" INTEGER NOT NULL UNIQUE REFERENCES "Round"("id") ON DELETE RESTRICT,
  "resale" INTEGER NOT NULL,
  "trip" INTEGER NOT NULL,
  "other" INTEGER NOT NULL
);

CREATE TABLE "PlatformCost" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "roundId" INTEGER NOT NULL UNIQUE REFERENCES "Round"("id") ON DELETE RESTRICT,
  "estimate" INTEGER NOT NULL,
  "actual" INTEGER
);

CREATE TABLE "Destination" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "roundId" INTEGER NOT NULL REFERENCES "Round"("id") ON DELETE RESTRICT,
  "materialId" INTEGER NOT NULL REFERENCES "Material"("id") ON DELETE RESTRICT,
  "grams" INTEGER NOT NULL,
  "rejected" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "at" TEXT NOT NULL,
  UNIQUE (roundId, materialId)
);

CREATE TABLE "Survey" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "roundId" INTEGER NOT NULL REFERENCES "Round"("id") ON DELETE RESTRICT,
  "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "amount" INTEGER NOT NULL,
  "note" TEXT NOT NULL,
  "at" TEXT NOT NULL,
  UNIQUE (roundId, userId)
);

CREATE TABLE "Estimate" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "roundId" INTEGER NOT NULL REFERENCES "Round"("id") ON DELETE RESTRICT,
  "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "resale" INTEGER NOT NULL,
  "trip" INTEGER NOT NULL,
  "other" INTEGER NOT NULL,
  UNIQUE (roundId, userId)
);

CREATE TABLE "Decline" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "roundId" INTEGER NOT NULL REFERENCES "Round"("id") ON DELETE RESTRICT,
  "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "reason" TEXT NOT NULL,
  "at" TEXT NOT NULL,
  UNIQUE (roundId, userId)
);

CREATE TABLE "Attachment" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "bookingId" INTEGER NOT NULL REFERENCES "Booking"("id") ON DELETE RESTRICT,
  "actorId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "kind" TEXT NOT NULL,
  "file" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "at" TEXT NOT NULL
);

CREATE TABLE "Audit" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "actorId" INTEGER REFERENCES "User"("id") ON DELETE RESTRICT,
  "action" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "at" TEXT NOT NULL
);

CREATE INDEX "User_communityId_idx" ON "User"("communityId");

CREATE INDEX "Session_userId_idx" ON "Session"("userId");

CREATE INDEX "Point_communityId_idx" ON "Point"("communityId");

CREATE INDEX "Price_materialId_idx" ON "Price"("materialId");

CREATE INDEX "Round_communityId_idx" ON "Round"("communityId");

CREATE INDEX "Round_pointId_idx" ON "Round"("pointId");

CREATE INDEX "Round_buyerId_idx" ON "Round"("buyerId");

CREATE INDEX "Round_invitedId_idx" ON "Round"("invitedId");

CREATE INDEX "Booking_roundId_idx" ON "Booking"("roundId");

CREATE INDEX "Booking_sellerId_idx" ON "Booking"("sellerId");

CREATE INDEX "BookingItem_bookingId_idx" ON "BookingItem"("bookingId");

CREATE INDEX "BookingItem_materialId_idx" ON "BookingItem"("materialId");

CREATE INDEX "Event_bookingId_idx" ON "Event"("bookingId");

CREATE INDEX "Event_actorId_idx" ON "Event"("actorId");

CREATE INDEX "Revision_bookingId_idx" ON "Revision"("bookingId");

CREATE INDEX "Revision_actorId_idx" ON "Revision"("actorId");

CREATE INDEX "WeighItem_revisionId_idx" ON "WeighItem"("revisionId");

CREATE INDEX "WeighItem_materialId_idx" ON "WeighItem"("materialId");

CREATE INDEX "Acceptance_sellerId_idx" ON "Acceptance"("sellerId");

CREATE INDEX "Payment_actorId_idx" ON "Payment"("actorId");

CREATE INDEX "Receipt_sellerId_idx" ON "Receipt"("sellerId");

CREATE INDEX "Dispute_bookingId_idx" ON "Dispute"("bookingId");

CREATE INDEX "Dispute_openerId_idx" ON "Dispute"("openerId");

CREATE INDEX "Dispute_handlerId_idx" ON "Dispute"("handlerId");

CREATE INDEX "Notice_userId_idx" ON "Notice"("userId");

CREATE INDEX "Agreement_roundId_idx" ON "Agreement"("roundId");

CREATE INDEX "Destination_roundId_idx" ON "Destination"("roundId");

CREATE INDEX "Destination_materialId_idx" ON "Destination"("materialId");

CREATE INDEX "Survey_roundId_idx" ON "Survey"("roundId");

CREATE INDEX "Survey_userId_idx" ON "Survey"("userId");

CREATE INDEX "Estimate_roundId_idx" ON "Estimate"("roundId");

CREATE INDEX "Estimate_userId_idx" ON "Estimate"("userId");

CREATE INDEX "Decline_roundId_idx" ON "Decline"("roundId");

CREATE INDEX "Decline_userId_idx" ON "Decline"("userId");

CREATE INDEX "Attachment_bookingId_idx" ON "Attachment"("bookingId");

CREATE INDEX "Attachment_actorId_idx" ON "Attachment"("actorId");

CREATE INDEX "Audit_actorId_idx" ON "Audit"("actorId");

CREATE TABLE AppVersion (id INTEGER PRIMARY KEY CHECK (id=1), revision INTEGER NOT NULL);
INSERT INTO AppVersion VALUES (1,0);
CREATE TABLE OwnerSetup (id INTEGER PRIMARY KEY CHECK (id=1), digest TEXT NOT NULL);
