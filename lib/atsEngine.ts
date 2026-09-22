/**
 * Built-in High-Precision ATS Engine Fallback
 * Provides 100% uptime resilient ATS scoring, keyword matching, and recruiter suggestions
 * when external AI models experience temporary 503 high-demand spikes.
 */

export interface AtsAnalysisResult {
  overall_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  suggestions: string[];
}

const COMMON_SKILLS_DICTIONARY = [
  // Programming Languages
  'TypeScript', 'JavaScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Golang', 'Rust', 'Ruby',
  'PHP', 'Swift', 'Kotlin', 'Scala', 'SQL', 'NoSQL', 'R', 'Bash', 'Shell',

  // Frontend & UI
  'React', 'Next.js', 'Vue.js', 'Angular', 'Svelte', 'Redux', 'Tailwind CSS', 'CSS3', 'HTML5',
  'Webpack', 'Vite', 'Responsive Design', 'Web Accessibility (a11y)', 'State Management',

  // Backend & APIs
  'Node.js', 'Express', 'NestJS', 'Django', 'FastAPI', 'Flask', 'Spring Boot', 'ASP.NET',
  'REST APIs', 'RESTful Services', 'GraphQL', 'gRPC', 'WebSockets', 'Microservices',

  // Databases & Storage
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'DynamoDB', 'Cassandra',
  'Snowflake', 'BigQuery', 'Firebase', 'Supabase', 'ORM / Prisma / TypeORM',

  // Cloud & Infrastructure
  'AWS', 'Amazon Web Services', 'GCP', 'Google Cloud', 'Microsoft Azure', 'Docker',
  'Kubernetes', 'Terraform', 'CI/CD', 'GitHub Actions', 'Jenkins', 'Linux', 'Serverless',
  'Cloud Architecture', 'Kafka', 'RabbitMQ',

  // Engineering Practices & Concepts
  'System Design', 'Distributed Systems', 'Performance Optimization', 'High Availability',
  'Scalability', 'Unit Testing', 'Integration Testing', 'TDD', 'Agile / Scrum', 'Git',
  'Object-Oriented Design', 'Code Review', 'Clean Architecture', 'API Design',

  // Soft Skills & Leadership
  'Team Leadership', 'Mentorship', 'Cross-functional Collaboration', 'Stakeholder Management',
  'Technical Roadmapping', 'Problem Solving', 'Communication', 'Project Management'
];

export function runLocalAtsAnalysis(resumeText: string, jobDescription: string): AtsAnalysisResult {
  const resumeLower = resumeText.toLowerCase();
  const jobLower = jobDescription.toLowerCase();

  // 1. Identify skills demanded in Job Description
  const matchedSet = new Set<string>();
  const missingSet = new Set<string>();
  const demandedSkills: string[] = [];

  for (const skill of COMMON_SKILLS_DICTIONARY) {
    const skillLower = skill.toLowerCase();
    const escaped = skillLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');

    if (regex.test(jobLower)) {
      demandedSkills.push(skill);
      if (regex.test(resumeLower)) {
        matchedSet.add(skill);
      } else {
        missingSet.add(skill);
      }
    }
  }

  // Extract common tech terms / capitalized keywords from job description
  const jobWords = jobDescription.match(/\b[A-Z][a-zA-Z0-9+#.-]{1,20}\b/g) || [];
  for (const word of jobWords) {
    if (
      word.length > 2 &&
      !demandedSkills.includes(word) &&
      !['The', 'And', 'For', 'With', 'You', 'Our', 'We', 'Are', 'This', 'Will', 'Must', 'Have', 'Job', 'Role', 'Company', 'Team', 'Work', 'Years', 'Plus'].includes(word)
    ) {
      const wLower = word.toLowerCase();
      if (resumeLower.includes(wLower)) {
        if (matchedSet.size < 14) matchedSet.add(word);
      } else {
        if (missingSet.size < 10) missingSet.add(word);
      }
    }
  }

  const matchedKeywords = Array.from(matchedSet);
  const missingKeywords = Array.from(missingSet);

  // 2. Strict ATS Score Calculation
  const totalKeywords = matchedKeywords.length + missingKeywords.length;
  const baseRatio = totalKeywords > 0 ? (matchedKeywords.length / totalKeywords) : 0.6;

  // Bonus for quantified achievements (e.g., % numbers, metrics) in resume
  const metricMatches = resumeText.match(/\b\d+(\.\d+)?%|\$\d+|\b\d+\+\s*(years|users|engineers|projects|clients)/gi) || [];
  const metricsCount = metricMatches.length;

  let calculatedScore = Math.round(baseRatio * 82);
  if (metricsCount >= 4) {
    calculatedScore += 8;
  } else if (metricsCount >= 2) {
    calculatedScore += 4;
  }

  // Length and formatting penalty / bonus
  if (resumeText.length > 800) calculatedScore += 4;
  if (missingKeywords.length > 6) calculatedScore -= 6;

  // Clamp score strictly between 28 and 96
  const overall_score = Math.max(28, Math.min(95, calculatedScore));

  // 3. Generate Strict Recruiter Actionable Suggestions
  const suggestions: string[] = [];

  if (missingKeywords.length > 0) {
    const topMissing = missingKeywords.slice(0, 3).join(', ');
    suggestions.push(
      `Explicitly weave high-priority requirements (${topMissing}) into your core technical skills and recent project accomplishments.`
    );
  }

  if (metricsCount < 3) {
    suggestions.push(
      'Quantify your business impact — replace generic task descriptions with measurable outcomes (e.g., "improved performance by 35%" or "scaled service to 100k+ daily users").'
    );
  } else {
    suggestions.push(
      'Strengthen your impact metrics by tying each bullet directly to company ROI, reduced latency, or team velocity.'
    );
  }

  suggestions.push(
    'Align your resume summary and job titles directly with the target role to pass initial algorithmic ATS filters before recruiter review.'
  );

  if (overall_score < 75) {
    suggestions.push(
      'Ensure standard ATS section headers (Professional Experience, Technical Skills, Education) are clearly labeled without non-standard nested formatting.'
    );
  } else {
    suggestions.push(
      'Elevate leadership and architectural ownership bullet points to the top third of your most recent role.'
    );
  }

  return {
    overall_score,
    matched_keywords: matchedKeywords.slice(0, 14),
    missing_keywords: missingKeywords.slice(0, 10),
    suggestions: suggestions.slice(0, 4),
  };
}
