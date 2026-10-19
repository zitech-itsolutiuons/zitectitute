# Cybersecurity Fundamentals: Safe Network Operations

## Learning goals

By the end of this short course, a student should be able to explain the CIA triad, distinguish a threat from a vulnerability and a risk, describe basic network defenses, and follow a safe incident-response process. The examples below are for classroom study. Any real security testing must have written authorization and a clearly defined scope.

## 1. Security goals and risk

Information security is often described through confidentiality, integrity, and availability. Confidentiality means that information is seen only by people and systems that are allowed to see it. Access controls, encryption, and careful handling of credentials can help protect confidentiality. Integrity means that information and systems remain accurate and are changed only in authorized ways. File hashes, signed updates, and change records can help detect or prevent unauthorized changes. Availability means that authorized users can reach the systems and information they need. Backups, tested recovery procedures, and resilient infrastructure support availability.

These goals can conflict. A strict access rule may improve confidentiality but make a service harder to use. A system kept online during maintenance may remain available but miss an important security update. A security decision should identify which goal is at risk, who depends on the system, and what impact a failure would have.

A threat is a possible cause of harm, such as a stolen password, a malicious attachment, or a power outage. A vulnerability is a weakness that could be used or triggered, such as an unpatched service, a reused password, or an unreliable power supply. Risk combines the likelihood of a threat using a vulnerability with the resulting impact. Risk is not the same as a vulnerability: a weakness may exist, but its risk depends on how likely it is to be reached and how serious the consequences would be.

Least privilege limits each account to the permissions needed for its current task. A student account should not need permission to change network-wide settings. Multi-factor authentication adds another proof of identity, such as a hardware key or authenticator code, so a password alone is not enough. Neither control makes an account invulnerable, but both reduce the chance or impact of common credential attacks.

## 2. Network defenses and the practice lab

A network is a set of connected devices that exchange data using agreed protocols. IP addresses identify endpoints for network communication. DNS translates human-readable names into addresses. A firewall applies rules to allow or block traffic based on properties such as source, destination, protocol, and port. A firewall can reduce exposure, but it cannot determine that every permitted request is harmless.

An intrusion detection system (IDS) observes activity and raises alerts about suspicious patterns. An intrusion prevention system (IPS) can also take configured action, such as blocking matching traffic. Alerts can be false positives, so an analyst checks the evidence and context before treating an alert as a confirmed incident. Network segmentation separates groups of systems and limits which parts of a network can communicate. Segmentation can reduce how far an intruder moves after gaining access to one device.

The fictional Northstar classroom lab uses the subnet 10.42.8.0/24. Its student workstation is 10.42.8.14, its training web server is 10.42.8.20, and its log collector is 10.42.8.50. For the scheduled exercise, the written authorization permits students to inspect only the training web server at 10.42.8.20, from the lab workstation, between 13:00 and 15:00 on Tuesday. The log collector is not an authorized target. The rest of the subnet is also out of scope, even though it belongs to the same lab.

Before any test, students record the authorized target, source, time window, allowed techniques, and contact person. If the target is unclear or an unexpected system appears, they stop and ask the instructor rather than probing it. A successful connection does not imply permission. Authorization comes from the written scope, not from technical reachability. Students must not scan the log collector at 10.42.8.50 during this exercise.

## 3. Recognizing and responding to an incident

Logs provide records of events such as sign-ins, configuration changes, and network connections. A single failed sign-in can be an ordinary mistake. Many failed sign-ins followed by a successful sign-in from the same source may deserve investigation. Analysts compare timestamps, account names, source addresses, affected systems, and known maintenance activity. They preserve relevant logs because deleting or changing evidence can make it harder to understand what happened.

Consider this classroom scenario: the training web server records 14 failed sign-ins for account `lab-editor` from address 10.42.8.77 between 14:02 and 14:03. At 14:05, the same address records a successful sign-in for that account. The course facts do not say who controlled 10.42.8.77, whether the password was guessed, or whether data was changed. These events are a reason to investigate, not proof by themselves that a particular person attacked the server.

A careful response has several parts. First, identify and record what was observed, including times and systems. Next, notify the responsible instructor or incident lead and preserve the relevant logs. Containment limits further harm; for this scenario, the instructor may temporarily disable the `lab-editor` account or restrict its access after confirming that doing so will not destroy needed evidence. Eradication removes the underlying cause, such as resetting a compromised credential and removing unauthorized access. Recovery restores normal service and checks that the system behaves as expected. A final review documents what happened, what evidence supports the conclusion, and what control could reduce the chance of recurrence.

Response actions should be proportionate and authorized. Students must not retaliate against an address, attempt to break into it, or make claims that the available evidence cannot support. If the facts do not establish the cause, the accurate report says that the cause is unknown and describes what should be checked next.

## Review questions

1. Which CIA goal concerns whether authorized users can reach a service?
2. In the Northstar exercise, what exact address is the only authorized target?
3. Why do 14 failed sign-ins followed by a successful sign-in justify investigation but not prove who caused them?
4. Which encryption algorithm does Northstar use for its VPN? This document does not specify one.
