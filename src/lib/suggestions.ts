/**
 * Autocomplete suggestion pools for TagInput dropdowns.
 *
 * Skills are seeded from the taxonomy (skillTaxonomy.ts) and augmented with
 * common industry skills that students/companies are likely to type. The lists
 * use title-cased display names — deduplication in TagInput is case-insensitive
 * so "react" and "React" won't produce duplicates.
 */

/** Common skills across tech, business, and creative disciplines. */
export const SKILL_SUGGESTIONS: string[] = [
  // --- Programming Languages ---
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C', 'C++', 'C#', 'Go',
  'Rust', 'Swift', 'Kotlin', 'Ruby', 'PHP', 'Dart', 'R', 'MATLAB',
  'Scala', 'Perl', 'Lua', 'Shell Scripting', 'Bash', 'SQL',

  // --- Frontend ---
  'React', 'Angular', 'Vue', 'Svelte', 'Next.js', 'Nuxt.js', 'HTML', 'CSS',
  'Sass', 'Tailwind CSS', 'Bootstrap', 'jQuery', 'Webpack', 'Vite',
  'Responsive Design', 'Web Accessibility',

  // --- Backend ---
  'Node.js', 'Express', 'Django', 'Flask', 'Spring Boot', 'ASP.NET', '.NET',
  'Ruby on Rails', 'Laravel', 'FastAPI', 'REST API', 'GraphQL',
  'API Development', 'Microservices',

  // --- Mobile ---
  'React Native', 'Flutter', 'SwiftUI', 'Android Development',
  'iOS Development', 'Mobile Development',

  // --- Databases ---
  'MySQL', 'PostgreSQL', 'MongoDB', 'SQLite', 'Redis', 'Firebase',
  'Supabase', 'DynamoDB', 'Oracle', 'SQL Server', 'Databases',

  // --- Cloud & DevOps ---
  'AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'CI/CD',
  'Terraform', 'Jenkins', 'GitHub Actions', 'Linux', 'DevOps',
  'Containers', 'Containerization',

  // --- Data & ML ---
  'Machine Learning', 'Artificial Intelligence', 'Deep Learning',
  'TensorFlow', 'PyTorch', 'Scikit-learn', 'Pandas', 'NumPy',
  'Data Analysis', 'Data Analytics', 'Data Visualization',
  'Data Science', 'Big Data', 'Computer Vision', 'NLP',
  'Statistics', 'Excel', 'Power BI', 'Tableau',

  // --- Design & Creative ---
  'Figma', 'Adobe XD', 'Sketch', 'Adobe Photoshop', 'Adobe Illustrator',
  'Adobe Premiere Pro', 'Adobe After Effects', 'Canva',
  'UI/UX Design', 'Graphic Design', 'Motion Graphics',
  'Video Editing', 'Photography', 'Typography',

  // --- Version Control & Tooling ---
  'Git', 'GitHub', 'GitLab', 'Bitbucket', 'Version Control',
  'Jira', 'Trello', 'Notion', 'Confluence', 'Slack',

  // --- Embedded & Hardware ---
  'Embedded Systems', 'Embedded Software', 'Embedded C', 'Firmware',
  'Firmware Development', 'Microcontroller', 'Microcontroller Programming',
  'Arduino', 'Raspberry Pi', 'ESP32', 'RTOS', 'ARM', 'ARM Cortex M',
  'UART', 'SPI', 'I2C', 'PCB Design', 'KiCad', 'Altium Designer',
  'Schematic Capture', 'Electronics Design', 'Soldering',

  // --- IoT ---
  'IoT', 'Internet of Things', 'MQTT', 'AWS IoT',

  // --- Networking ---
  'Networking', 'Network Engineering', 'TCP/IP', 'CCNA',
  'Cisco IOS', 'Network Security', 'Wireshark',

  // --- Robotics ---
  'Robotics', 'Robotics Software', 'ROS', 'Control Systems', 'OpenCV',

  // --- RF / Telecom ---
  'RF Engineering', 'Telecommunications', 'RF Fundamentals',
  'Spectrum Analysis', 'LTE/5G',

  // --- Automation ---
  'Automation', 'Automation Engineering', 'PLC', 'Ladder Logic',
  'SCADA', 'HMI',

  // --- Soft Skills ---
  'Communication', 'Teamwork', 'Leadership', 'Problem Solving',
  'Critical Thinking', 'Time Management', 'Project Management',
  'Presentation Skills', 'Public Speaking', 'Writing',
  'Research', 'Analytical Thinking', 'Adaptability',
  'Collaboration', 'Creativity', 'Attention to Detail',

  // --- Business & Marketing ---
  'Marketing', 'Digital Marketing', 'SEO', 'SEM',
  'Social Media Marketing', 'Content Marketing', 'Copywriting',
  'Market Research', 'Brand Management', 'Google Analytics',
  'Email Marketing', 'Advertising', 'Campaign Management',

  // --- Finance & Accounting ---
  'Accounting', 'Financial Analysis', 'Bookkeeping', 'QuickBooks',
  'Budgeting', 'Financial Reporting', 'Taxation',

  // --- Methodology ---
  'Agile', 'Scrum', 'Kanban', 'Waterfall',
  'Object Oriented Programming', 'Data Structures and Algorithms',

  // --- Security ---
  'Cybersecurity', 'Penetration Testing', 'Ethical Hacking',
  'Information Security', 'Encryption',

  // --- Other Tech ---
  'Blockchain', 'Web3', 'Game Development', 'Unity', 'Unreal Engine',
  'AR/VR', '3D Modeling', 'Blender', 'AutoCAD', 'SolidWorks',
]

/** Common specialization / field suggestions. */
export const SPECIALIZATION_SUGGESTIONS: string[] = [
  'Frontend Development', 'Backend Development', 'Full Stack Development',
  'Mobile Development', 'Web Development', 'Software Development',
  'Software Engineering', 'DevOps', 'Cloud Computing',
  'Data Science', 'Data Analytics', 'Data Engineering',
  'Machine Learning', 'Artificial Intelligence', 'Deep Learning',
  'Computer Vision', 'Natural Language Processing',
  'Cybersecurity', 'Information Security', 'Network Engineering',
  'Embedded Systems', 'Firmware Development', 'IoT',
  'Robotics', 'Automation Engineering',
  'Hardware Engineering', 'Electronics Design', 'PCB Design',
  'RF Engineering', 'Telecommunications',
  'UI/UX Design', 'Graphic Design', 'Product Design',
  'Game Development', 'AR/VR Development',
  'Quality Assurance', 'QA Automation', 'Software Testing',
  'Database Administration', 'Systems Administration',
  'Project Management', 'Scrum Master', 'Business Analysis',
  'Marketing', 'Digital Marketing', 'Content Marketing',
  'Social Media Management', 'Brand Management',
  'Financial Analysis', 'Accounting', 'Human Resources',
  'Technical Writing', 'Content Creation',
  'Customer Support', 'Sales', 'Operations',
  'Supply Chain Management', 'Logistics',
  'Research and Development', 'Consulting',
]

/** Common company names for autocomplete. */
export const COMPANY_SUGGESTIONS: string[] = [
  'Accenture', 'Adobe', 'Amdocs', 'Amazon', 'Apple', 'Atlassian',
  'Ayala Corporation', 'BDO Unibank', 'BPI', 'Canva',
  'Cisco', 'Citibank', 'Cognizant', 'Concentrix',
  'Deloitte', 'DXC Technology', 'EY', 'Facebook', 'Fujitsu',
  'Globe Telecom', 'Google', 'HP', 'HCL Technologies',
  'Huawei', 'IBM', 'Infosys', 'Intel', 'Jollibee Group',
  'JP Morgan', 'KPMG', 'Lenovo', 'LG', 'Manulife',
  'Maxim Integrated', 'Meta', 'Meralco', 'Microsoft',
  'Motorola', 'NEC', 'NetSuite', 'Nokia', 'Nvidia',
  'Oracle', 'Panasonic', 'PayMaya', 'PLDT', 'Procter & Gamble',
  'PwC', 'Qualcomm', 'Rakuten', 'Salesforce', 'Samsung',
  'San Miguel Corporation', 'SAP', 'Shopee', 'Siemens',
  'Smart Communications', 'Sony', 'Spotify', 'Stripe',
  'Sun Life', 'Tata Consultancy Services', 'TaskUs',
  'Texas Instruments', 'Toshiba', 'Toyota', 'Uber',
  'Unilever', 'Visa', 'VMware', 'Wipro', 'Xerox', 'Yahoo', 'Zendesk',
]
