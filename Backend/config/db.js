const memoryDb = {
  users: [
    {
      id: "user_demo",
      name: "Demo User",
      email: "sunny@gmail.com",
      password_hash: "$2b$10$LmiESBSOSVty/3GGBfTl.OMeIFxHZ9bfy2gTtOIypXoupMLP/iIPa",
      refer_by: "student-project"
    }
  ],
  screenings: [],
  taskResponses: [],
  assessmentResults: []
};

export const seedDemoUser = async () => {
  if (memoryDb.users.some((user) => user.email === "sunny@gmail.com")) return;
  memoryDb.users.push({
    id: "user_demo",
    name: "Demo User",
    email: "sunny@gmail.com",
    password_hash: "$2b$10$LmiESBSOSVty/3GGBfTl.OMeIFxHZ9bfy2gTtOIypXoupMLP/iIPa",
    refer_by: "student-project"
  });
};

export const query = async (text, params = []) => {
  const normalized = text.trim();

  if (normalized.toLowerCase().includes("insert into users") || normalized.toLowerCase().includes("select * from users")) {
    const [email] = params;
    if (normalized.toLowerCase().includes("select * from users")) {
      const match = memoryDb.users.find((user) => user.email === email);
      return { rows: match ? [match] : [] };
    }
  }

  if (normalized.toLowerCase().includes("insert into users")) {
    const [name, email, passwordHash, referBy] = params;
    const newUser = {
      id: `user_${Date.now()}`,
      name,
      email,
      password_hash: passwordHash,
      refer_by: referBy || null
    };
    memoryDb.users.push(newUser);
    return { rows: [{ ...newUser }] };
  }

  return { rows: [] };
};

export const pool = {
  query
};

export const memoryDbStore = memoryDb;
export default memoryDb;