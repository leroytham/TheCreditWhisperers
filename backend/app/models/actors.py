# models/actors.py

from __future__ import annotations
from typing import List, Set
from .portfolio import Portfolio

# #############################################################################
# BASE AND INHERITED ACTOR CLASSES
# #############################################################################

class Person:
    """A base class representing a human individual.
    
    This class serves as a foundation for more specific roles like Client,
    ClientAdvisor, and InvestmentConsultant.

    Attributes:
        person_id (str): A unique identifier for the person.
        first_name (str): The person's first name.
        last_name (str): The person's last name.
    """
    def __init__(self, person_id: str, first_name: str, last_name: str):
        self.person_id = person_id
        self.first_name = first_name
        self.last_name = last_name

    def __repr__(self):
        """Provides a clean string representation of the Person object."""
        return f"{self.__class__.__name__}({self.first_name} {self.last_name})"

class Client(Person):
    """Represents a client who owns a portfolio. Inherits from Person.

    Each client is initialized with a dedicated portfolio and can be
    assigned to a ClientAdvisor.

    Attributes:
        portfolio (Portfolio): The client's investment portfolio.
        advisor (ClientAdvisor | None): The advisor managing this client.
    """
    def __init__(self, person_id: str, first_name: str, last_name: str):
        super().__init__(person_id, first_name, last_name)
        # Each client has a one-to-one relationship with a Portfolio.
        self.portfolio = Portfolio(f"PORT_{person_id}", self)
        self.advisor: ClientAdvisor | None = None

# #############################################################################
# ORGANIZATIONAL AND PROFESSIONAL CLASSES
# #############################################################################

class Team:
    """Represents a team of financial professionals.

    This class groups ClientAdvisors and InvestmentConsultants together and
    is central to defining the responsibility scope for consultants.

    Attributes:
        team_id (str): A unique identifier for the team.
        team_name (str): The display name for the team.
        client_advisors (List[ClientAdvisor]): A list of advisors in the team.
        investment_consultants (List[InvestmentConsultant]): A list of consultants in the team.
    """
    def __init__(self, team_id: str, team_name: str):
        self.team_id = team_id
        self.team_name = team_name
        self.client_advisors: List[ClientAdvisor] = []
        self.investment_consultants: List[InvestmentConsultant] = []

    def add_advisor(self, advisor: ClientAdvisor):
        """Adds a ClientAdvisor to the team and sets their team attribute."""
        if advisor not in self.client_advisors:
            self.client_advisors.append(advisor)
            advisor.team = self

    def add_consultant(self, consultant: InvestmentConsultant):
        """Adds an InvestmentConsultant to the team and sets their team attribute."""
        if consultant not in self.investment_consultants:
            self.investment_consultants.append(consultant)
            consultant.team = self

    def get_all_team_clients(self) -> Set[Client]:
        """Returns a set of all unique clients managed by this team's advisors.
        
        This method aggregates clients from all advisors within the team,
        ensuring no duplicates.
        """
        all_clients = set()
        for advisor in self.client_advisors:
            all_clients.update(advisor.clients)
        return all_clients

class ClientAdvisor(Person):
    """Represents a client advisor responsible for managing clients directly.

    Inherits from Person and maintains a direct one-to-many relationship
    with the Clients they manage.

    Attributes:
        clients (List[Client]): The list of clients directly managed by the advisor.
        team (Team | None): The team to which the advisor belongs.
    """
    def __init__(self, person_id: str, first_name: str, last_name: str):
        super().__init__(person_id, first_name, last_name)
        self.clients: List[Client] = []
        self.team: Team | None = None

    def add_client(self, client: Client):
        """Assigns a client to this advisor."""
        if client not in self.clients:
            self.clients.append(client)
            client.advisor = self

class InvestmentConsultant(Person):
    """Represents a specialist consultant. Inherits from Person.

    Their responsibility is not to individual clients, but to all clients
    managed by the ClientAdvisors within their assigned team.

    Attributes:
        specialization (str): The consultant's area of expertise (e.g., "Equities").
        team (Team | None): The team to which the consultant belongs.
    """
    def __init__(self, person_id: str, first_name: str, last_name: str, specialization: str):
        super().__init__(person_id, first_name, last_name)
        self.specialization = specialization
        self.team: Team | None = None

    def get_responsible_clients(self) -> Set[Client]:
        """Gets all clients from the advisors in this consultant's team.
        
        This method defines the scope of the consultant's responsibility by
        delegating the client lookup to their assigned team.
        """
        if not self.team:
            return set()
        return self.team.get_all_team_clients()