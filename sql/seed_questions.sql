-- sql/seed_questions.sql
-- Seed script for initial 25 networking questions.
-- Run after schema:
--   psql -d your_db_name -f sql/seed_questions.sql

INSERT INTO questions
(category, text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty)
VALUES
-- OSI Model (5)
('OSI', 'Which OSI layer is responsible for routing packets between networks?', 
 'Physical', 'Network', 'Transport', 'Data Link', 'B',
 'Routing and logical addressing (IP addresses) are handled at the Network layer.', 'Easy'),

('OSI', 'At which OSI layer does a switch primarily operate?', 
 'Physical', 'Transport', 'Data Link', 'Session', 'C',
 'Switches usually operate at Layer 2 (Data Link), forwarding frames based on MAC addresses.', 'Easy'),

('OSI', 'Which OSI layer is responsible for end-to-end reliability and flow control?', 
 'Network', 'Data Link', 'Transport', 'Application', 'C',
 'The Transport layer provides reliable delivery, acknowledgments, and flow control.', 'Easy'),

('OSI', 'Which protocol is MOST associated with the OSI Presentation layer?', 
 'TCP', 'IP', 'TLS/SSL', 'ARP', 'C',
 'The Presentation layer is responsible for encryption, compression, and translation, which TLS/SSL provides.', 'Medium'),

('OSI', 'Which statement BEST describes the Session layer?', 
 'It defines physical connectors and electrical signals.', 
 'It manages dialogs, checkpoints, and reestablishing connections between endpoints.', 
 'It forwards packets based on logical addressing.', 
 'It provides application-specific protocols like HTTP.', 
 'B',
 'The Session layer sets up, manages, and tears down sessions between applications.', 'Medium'),

 

-- TCP/IP & Protocols (5)
('TCP_IP', 'Which protocol provides connection-oriented, reliable delivery at the transport layer?', 
 'UDP', 'TCP', 'IP', 'ICMP', 'B',
 'TCP provides connection-oriented, reliable transport with acknowledgments and retransmissions.', 'Easy'),

('TCP_IP', 'Which protocol is used to map domain names (like example.com) to IP addresses?', 
 'HTTP', 'DNS', 'DHCP', 'SMTP', 'B',
 'DNS resolves human-readable names to IP addresses.', 'Easy'),

('TCP_IP', 'Which protocol is used primarily for sending diagnostic error messages such as "destination unreachable"?', 
 'TCP', 'UDP', 'ICMP', 'ARP', 'C',
 'ICMP is used for control and diagnostic messages, including error reporting.', 'Medium'),

('TCP_IP', 'Which protocol is typically used for streaming video where occasional loss is acceptable?', 
 'TCP', 'UDP', 'ICMP', 'HTTPS', 'B',
 'UDP is often used for real-time streaming where speed matters more than reliability.', 'Medium'),

('TCP_IP', 'What is the primary purpose of DHCP?', 
 'Encrypting IP traffic', 'Assigning IP addresses dynamically', 'Resolving domain names', 'Checking host reachability', 'B',
 'DHCP automatically assigns IP configuration parameters like IP address, subnet mask, and default gateway.', 'Easy'),

-- IP Addressing & Subnetting (5)
('IP_SUBNETTING', 'How many usable host addresses does a /24 IPv4 subnet provide?', 
 '254', '256', '255', '128', 'A',
 'A /24 network has 256 total addresses; 2 are reserved (network and broadcast), leaving 254 usable.', 'Easy'),

('IP_SUBNETTING', 'Which of the following is a valid private IPv4 address?', 
 '8.8.8.8', '172.16.5.10', '192.0.2.5', '203.0.113.7', 'B',
 '172.16.0.0 to 172.31.255.255 is one of the private IP ranges.', 'Easy'),

('IP_SUBNETTING', 'What is the subnet mask for a /26 prefix?', 
 '255.255.255.0', '255.255.255.128', '255.255.255.192', '255.255.255.224', 'C',
 'A /26 leaves 6 bits for hosts; in dotted-decimal that mask is 255.255.255.192.', 'Medium'),

('IP_SUBNETTING', 'Which address type is used to send a packet to all hosts on the same subnet?', 
 'Unicast', 'Multicast', 'Broadcast', 'Anycast', 'C',
 'A broadcast address targets all hosts on the local subnet.', 'Easy'),

('IP_SUBNETTING', 'In CIDR notation, which prefix corresponds to 255.255.255.248?', 
 '/27', '/28', '/29', '/30', 'C',
 '255.255.255.248 leaves 3 bits for host addresses, which is a /29.', 'Medium'),

-- Routing Concepts (5)
('ROUTING', 'What is the primary function of a router?', 
 'Connect end devices within the same LAN', 
 'Forward packets between different networks', 
 'Convert analog signals to digital', 
 'Filter frames based on MAC addresses', 'B',
 'Routers connect different networks and make forwarding decisions based on IP addresses.', 'Easy'),

('ROUTING', 'Which of the following is a distance-vector routing protocol?', 
 'OSPF', 'EIGRP', 'BGP', 'RIP', 'D',
 'RIP is a classic distance-vector routing protocol using hop count as its metric.', 'Medium'),

('ROUTING', 'What is the main advantage of using a dynamic routing protocol?', 
 'It reduces the need for IP addressing', 
 'It automatically updates routes when the network changes', 
 'It increases physical link speeds', 
 'It eliminates the need for routers', 'B',
 'Dynamic routing protocols automatically adjust routing tables when topology changes.', 'Easy'),

('ROUTING', 'What does the "cost" metric represent in many routing protocols like OSPF?', 
 'The financial cost of links', 
 'An abstract value representing path preference (often based on bandwidth)', 
 'The number of users on the network', 
 'The physical length of the cable', 'B',
 'Cost is an abstract metric, often inversely related to bandwidth, used to select the best path.', 'Medium'),

('ROUTING', 'What is the purpose of a default route (0.0.0.0/0)?', 
 'To block all unknown traffic', 
 'To send traffic for unknown networks to a specific next-hop', 
 'To advertise private networks only', 
 'To limit broadcast domains', 'B',
 'A default route is used when no more specific route exists, forwarding traffic to a next-hop.', 'Easy'),

-- Application Layer Protocols (3)
('APP_PROTOCOLS', 'Which protocol and port are typically used for secure web browsing?', 
 'HTTP on port 80', 'HTTPS on port 443', 'FTP on port 21', 'SSH on port 22', 'B',
 'HTTPS applies TLS encryption on top of HTTP, commonly using TCP port 443.', 'Easy'),

('APP_PROTOCOLS', 'Which application-layer protocol is primarily used for sending email from a client to a mail server?', 
 'IMAP', 'POP3', 'SMTP', 'DNS', 'C',
 'SMTP is used to send email between clients and mail servers or between servers.', 'Easy'),

('APP_PROTOCOLS', 'Which protocol is commonly used for remote shell access to a server over an encrypted channel?', 
 'Telnet', 'SSH', 'FTP', 'RDP', 'B',
 'SSH provides encrypted, command-line remote access.', 'Medium'),

-- Network Security (2)
('SECURITY', 'What is the main purpose of a firewall in network security?', 
 'To accelerate network traffic', 
 'To store encryption keys', 
 'To enforce access control policies between networks', 
 'To provide wireless connectivity', 'C',
 'Firewalls inspect traffic and enforce access rules between network segments.', 'Easy'),

('SECURITY', 'Which of the following best describes a man-in-the-middle (MITM) attack?', 
 'An attacker floods a target with traffic to cause a DoS.', 
 'An attacker secretly intercepts and possibly alters communication between two parties.', 
 'An attacker guesses passwords using a dictionary file.', 
 'An attacker plugs in an unauthorized wireless access point.', 'B',
 'In a MITM attack, the attacker sits between two parties to eavesdrop and potentially modify traffic.', 'Medium');

-- ============================
-- ADDITIONAL QUESTIONS (25)
-- ============================

-- OSI Model (5 more → total 10)
INSERT INTO questions
(category, text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty)
VALUES
('OSI', 'Which OSI layer performs encryption and data format translation?',
 'Application', 'Session', 'Presentation', 'Transport', 'C',
 'The Presentation layer handles encryption, compression, and data format translation.', 'Medium'),

('OSI', 'Which OSI layer is responsible for establishing logical connections using IP addresses?',
 'Physical', 'Data Link', 'Network', 'Transport', 'C',
 'The Network layer uses logical addressing such as IP addresses to route packets.', 'Easy'),

('OSI', 'Where does flow control at the end-to-end level primarily occur?',
 'Data Link layer', 'Transport layer', 'Network layer', 'Session layer', 'B',
 'End-to-end flow control is handled by the Transport layer.', 'Medium'),

('OSI', 'Which OSI layer is closest to the end user?',
 'Application', 'Presentation', 'Session', 'Transport', 'A',
 'The Application layer provides services directly to user applications.', 'Easy'),

('OSI', 'Which OSI layer is responsible for framing data for transmission?',
 'Physical', 'Data Link', 'Network', 'Presentation', 'B',
 'The Data Link layer packages raw bits into frames for reliable transmission.', 'Easy');

-- TCP/IP & Protocols (5 more → total 10)
INSERT INTO questions
(category, text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty)
VALUES
('TCP_IP', 'Which protocol resolves IP addresses to MAC addresses on a local network?',
 'DNS', 'ARP', 'ICMP', 'DHCP', 'B',
 'ARP maps IP addresses to MAC addresses within the local network.', 'Easy'),

('TCP_IP', 'Which protocol ensures reliable, ordered delivery of data?',
 'UDP', 'ICMP', 'TCP', 'IP', 'C',
 'TCP provides reliability, sequencing, and retransmission.', 'Easy'),

('TCP_IP', 'Which protocol is commonly used to test network connectivity?',
 'DNS', 'ICMP', 'HTTP', 'SMTP', 'B',
 'ICMP is used for diagnostic tools like ping.', 'Easy'),

('TCP_IP', 'What TCP mechanism prevents a sender from overwhelming a receiver?',
 'Encryption', 'Congestion control', 'Flow control', 'Segmentation', 'C',
 'Flow control ensures the sender does not exceed the receiver’s capacity.', 'Medium'),

('TCP_IP', 'Which port is used by SMTP by default?',
 '25', '53', '80', '443', 'A',
 'SMTP typically uses TCP port 25 to send email.', 'Easy');

-- IP Addressing & Subnetting (5 more → total 10)
INSERT INTO questions
(category, text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty)
VALUES
('IP_SUBNETTING', 'What type of IP address is 127.0.0.1?',
 'Private', 'Loopback', 'Multicast', 'Broadcast', 'B',
 '127.0.0.1 is the loopback address used for local host testing.', 'Easy'),

('IP_SUBNETTING', 'Which prefix length provides 14 usable host addresses?',
 '/28', '/27', '/26', '/25', 'A',
 'A /28 subnet has 16 total addresses, 14 usable after reserving network and broadcast.', 'Medium'),

('IP_SUBNETTING', 'Which IPv4 class provides the largest number of networks?',
 'Class A', 'Class B', 'Class C', 'Class D', 'C',
 'Class C has the largest number of possible networks.', 'Medium'),

('IP_SUBNETTING', 'What does CIDR allow administrators to do?',
 'Eliminate routers', 'Use classful addressing', 'Allocate address space more efficiently', 'Encrypt IP packets', 'C',
 'CIDR enables flexible prefix lengths for efficient IP allocation.', 'Medium'),

('IP_SUBNETTING', 'Which address cannot be assigned to a host?',
 '192.168.1.1', '192.168.1.255', '192.168.1.10', '192.168.1.100', 'B',
 'The broadcast address cannot be assigned to a host.', 'Easy');

-- Routing Concepts (5 more → total 10)
INSERT INTO questions
(category, text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty)
VALUES
('ROUTING', 'Which routing protocol is classified as path-vector?',
 'OSPF', 'RIP', 'BGP', 'EIGRP', 'C',
 'BGP is a path-vector protocol used between autonomous systems.', 'Medium'),

('ROUTING', 'Which routing protocol uses bandwidth as its primary metric?',
 'RIP', 'OSPF', 'EIGRP', 'BGP', 'C',
 'EIGRP uses bandwidth and delay to calculate routing metrics.', 'Medium'),

('ROUTING', 'What happens when a routing loop occurs?',
 'Traffic is encrypted', 'Packets circulate endlessly', 'Routing tables synchronize', 'Latency decreases', 'B',
 'Routing loops cause packets to circulate endlessly until TTL expires.', 'Medium'),

('ROUTING', 'Which command typically shows the routing table on a router?',
 'show ip route', 'show arp', 'show mac address-table', 'ping', 'A',
 'The routing table is displayed using show ip route.', 'Easy'),

('ROUTING', 'Which value limits how long a packet can exist in a network?',
 'Cost', 'Metric', 'TTL', 'Bandwidth', 'C',
 'TTL (Time To Live) prevents packets from looping indefinitely.', 'Easy');

-- Application Layer Protocols (2 more → total 5)
INSERT INTO questions
(category, text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty)
VALUES
('APP_PROTOCOLS', 'Which protocol allows file transfer between hosts?',
 'FTP', 'SMTP', 'HTTP', 'SNMP', 'A',
 'FTP is designed for transferring files between systems.', 'Easy'),

('APP_PROTOCOLS', 'Which protocol is used to retrieve email from a server?',
 'SMTP', 'DNS', 'IMAP', 'HTTP', 'C',
 'IMAP allows clients to retrieve and manage email stored on a server.', 'Easy');

-- Network Security (3 more → total 5)
INSERT INTO questions
(category, text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty)
VALUES
('SECURITY', 'Which security principle ensures users have only the access they need?',
 'Defense in depth', 'Least privilege', 'Availability', 'Non-repudiation', 'B',
 'Least privilege limits access rights to the minimum required.', 'Medium'),

('SECURITY', 'What type of attack attempts to overwhelm a system with traffic?',
 'Spoofing', 'Phishing', 'DoS', 'SQL Injection', 'C',
 'A Denial-of-Service attack floods a system with excessive traffic.', 'Easy'),

('SECURITY', 'Which technology encrypts traffic between two networks over the internet?',
 'Firewall', 'IDS', 'VPN', 'NAT', 'C',
 'VPNs create encrypted tunnels across untrusted networks.', 'Easy');

