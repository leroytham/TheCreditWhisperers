# tests/models/test_actors.py

import unittest
from app.models import Person, Client, ClientAdvisor, InvestmentConsultant, Team

class TestActors(unittest.TestCase):

    def setUp(self):
        """Set up actors and a team for testing."""
        self.team = Team(team_id="T1", team_name="Alpha Team")
        self.advisor1 = ClientAdvisor("A1", "John", "Doe")
        self.advisor2 = ClientAdvisor("A2", "Jane", "Smith")
        self.consultant = InvestmentConsultant("C1", "Sam", "Jones", "Equities")
        
        self.client1 = Client("CL1", "Alice", "Wonder")
        self.client2 = Client("CL2", "Bob", "Builder")
        self.client3 = Client("CL3", "Charlie", "Chocolate")

    def test_person_creation(self):
        """Test basic Person creation."""
        person = Person("P1", "Test", "User")
        self.assertEqual(person.first_name, "Test")

    def test_client_has_portfolio(self):
        """Test that a Client is initialized with a Portfolio."""
        self.assertIsNotNone(self.client1.portfolio)
        self.assertEqual(self.client1.portfolio.owner, self.client1)

    def test_add_advisor_and_consultant_to_team(self):
        """Test adding members to a Team and linking them back."""
        self.team.add_advisor(self.advisor1)
        self.team.add_consultant(self.consultant)

        self.assertIn(self.advisor1, self.team.client_advisors)
        self.assertIn(self.consultant, self.team.investment_consultants)
        self.assertEqual(self.advisor1.team, self.team)
        self.assertEqual(self.consultant.team, self.team)

    def test_advisor_manages_clients(self):
        """Test the one-to-many relationship between Advisor and Client."""
        self.advisor1.add_client(self.client1)
        self.advisor1.add_client(self.client2)

        self.assertEqual(len(self.advisor1.clients), 2)
        self.assertIn(self.client1, self.advisor1.clients)
        self.assertEqual(self.client1.advisor, self.advisor1)

    def test_consultant_responsibility(self):
        """Test that a consultant is responsible for all clients in their team."""
        # Pre-condition: consultant has no clients if not in a team
        self.assertEqual(len(self.consultant.get_responsible_clients()), 0)

        # Assign everyone to the team
        self.team.add_advisor(self.advisor1)
        self.team.add_advisor(self.advisor2)
        self.team.add_consultant(self.consultant)

        # Assign clients to advisors
        self.advisor1.add_client(self.client1)
        self.advisor2.add_client(self.client2)
        self.advisor2.add_client(self.client3)

        responsible_clients = self.consultant.get_responsible_clients()
        
        self.assertEqual(len(responsible_clients), 3)
        self.assertTrue({self.client1, self.client2, self.client3}.issubset(responsible_clients))