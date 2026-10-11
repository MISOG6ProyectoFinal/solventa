# Identidad del pipeline. GitHub Actions asume este rol con un token OIDC de corta
# duración: ninguna clave de acceso vive en el repositorio ni en sus secretos.
#
# Este stack lo aplica una persona una sola vez (deploy/scripts/bootstrap-ci.sh).
# El pipeline aplica los demás stacks con el rol que se crea aquí.
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_policy_document" "trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Solo dos orígenes: jobs que corren sobre la rama de despliegue y jobs ligados
    # al Environment de GitHub. Un pull request o una rama de trabajo quedan fuera.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_repository}:ref:refs/heads/${var.deploy_branch}",
        "repo:${var.github_repository}:environment:${var.environment}",
      ]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "solventa-github-deploy-${var.environment}"
  description        = "Rol que asume GitHub Actions para desplegar Solventa (${var.environment})"
  assume_role_policy = data.aws_iam_policy_document.trust.json
  # Crear EKS y las bases en un mismo apply supera la hora por defecto.
  max_session_duration = 14400
}

# Misma política que usan los desarrolladores que despliegan a mano.
resource "aws_iam_policy" "deploy" {
  name   = "solventa-github-deploy-${var.environment}"
  policy = file("${path.module}/../../../iam/solventa-deployer-policy.json")
}

resource "aws_iam_role_policy_attachment" "deploy" {
  role       = aws_iam_role.deploy.name
  policy_arn = aws_iam_policy.deploy.arn
}

# El pipeline crea roles para el clúster, pero su propia identidad queda fuera de su alcance.
data "aws_iam_policy_document" "protect_identity" {
  statement {
    sid    = "ElPipelineNoCambiaSuPropiaIdentidad"
    effect = "Deny"
    actions = [
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:UpdateAssumeRolePolicy",
      "iam:UpdateRole",
      "iam:DeleteRole",
      "iam:CreatePolicyVersion",
      "iam:DeletePolicyVersion",
      "iam:SetDefaultPolicyVersion",
      "iam:DeletePolicy",
      "iam:DeleteOpenIDConnectProvider",
      "iam:UpdateOpenIDConnectProviderThumbprint",
      "iam:AddClientIDToOpenIDConnectProvider",
    ]
    resources = [
      aws_iam_role.deploy.arn,
      aws_iam_policy.deploy.arn,
      aws_iam_openid_connect_provider.github.arn,
    ]
  }
}

resource "aws_iam_role_policy" "protect_identity" {
  name   = "protect-pipeline-identity"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.protect_identity.json
}
